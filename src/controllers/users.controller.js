import { supabase } from '../lib/supabase.js';

/**
 * GET /api/users
 * Get all users with pagination, filtering, and search (Admin/Librarian only)
 */
export const getAllUsers = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            search = '',
            role_id = '',
            status = '',
            sort_by = 'email',
            sort_order = 'desc'
        } = req.query;

        const offset = (page - 1) * limit;

        // Build query
        let query = supabase
            .from('users')
            .select(`
                *,
                roles(id, name)
            `, { count: 'exact' });

        // Apply filters
        if (search) {
            query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,identity_code.ilike.%${search}%`);
        }

        if (role_id) {
            query = query.eq('role_id', role_id);
        }

        if (status) {
            query = query.eq('status', status);
        }

        // Apply sorting
        query = query.order(sort_by, { ascending: sort_order === 'asc' });

        // Apply pagination
        query = query.range(offset, offset + limit - 1);

        const { data: users, error, count } = await query;

        if (error) {
            return res.status(500).json({ ok: false, message: error.message });
        }

        const totalPages = Math.ceil(count / limit);

        return res.status(200).json({
            ok: true,
            data: {
                users,
                pagination: {
                    current_page: parseInt(page),
                    total_pages: totalPages,
                    total_items: count,
                    limit: parseInt(limit)
                }
            }
        });
    } catch (err) {
        console.error('getAllUsers error:', err);
        return res.status(500).json({ ok: false, message: 'Internal server error' });
    }
};

/**
 * GET /api/users/roles
 * Get all available roles
 */
export const getRoles = async (req, res) => {
    try {
        const { data: roles, error } = await supabase
            .from('roles')
            .select('*')
            .order('name');

        if (error) {
            return res.status(500).json({ ok: false, message: error.message });
        }

        return res.status(200).json({ ok: true, data: roles });
    } catch (err) {
        console.error('getRoles error:', err);
        return res.status(500).json({ ok: false, message: 'Internal server error' });
    }
};

/**
 * GET /api/users/:id
 * Get user details by ID
 */
export const getUserById = async (req, res) => {
    try {
        const { id } = req.params;

        const { data: user, error } = await supabase
            .from('users')
            .select(`
                *,
                roles(id, name)
            `)
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({ ok: false, message: 'User not found' });
            }
            return res.status(500).json({ ok: false, message: error.message });
        }

        return res.status(200).json({ ok: true, data: user });
    } catch (err) {
        console.error('getUserById error:', err);
        return res.status(500).json({ ok: false, message: 'Internal server error' });
    }
};

/**
 * POST /api/users
 * Create a new user (Admin/Librarian only)
 * This handles creating the user in Supabase Auth first, then in public.users
 */
export const createUser = async (req, res) => {
    try {
        const {
            full_name,
            email,
            identity_code,
            phone,
            address,
            role_id
        } = req.body;

        if (!email) {
            return res.status(400).json({ ok: false, message: 'Email is required' });
        }

        // Check if admin auth is available
        if (!supabase.auth.admin) {
            return res.status(500).json({ 
                ok: false, 
                message: 'Supabase Service Role Key is missing. Admin user creation is not possible without it.' 
            });
        }

        // 1. Create user in Supabase Auth
        // We use a random password since they should login via Google or Reset Password later
        const randomPassword = Math.random().toString(36).slice(-12) + 'A1!';
        
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email,
            password: randomPassword,
            email_confirm: true, // Auto-confirm so they can login immediately
            user_metadata: { full_name }
        });

        if (authError) {
            // Handle case where user already exists in Auth
            if (authError.message.includes('already registered') || authError.status === 422) {
                // Try to find the existing auth user to get their ID
                // Note: We might need to list users or check if they exist in public.users already
                const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();
                if (listError) return res.status(500).json({ ok: false, message: 'User exists in Auth but failed to retrieve details' });
                
                const existingAuthUser = existingUsers.users.find(u => u.email === email);
                if (existingAuthUser) {
                    // Check if they exist in public.users
                    const { data: publicUser } = await supabase
                        .from('users')
                        .select('id')
                        .eq('id', existingAuthUser.id)
                        .maybeSingle();
                    
                    if (publicUser) {
                        return res.status(400).json({ ok: false, message: 'User already exists in the system' });
                    }
                    
                    // If they exist in Auth but not in public.users, proceed with insertion using their Auth ID
                    return await insertPublicUser(existingAuthUser.id, { full_name, email, identity_code, phone, address, role_id }, res);
                }
            }
            return res.status(400).json({ ok: false, message: `Auth Error: ${authError.message}` });
        }

        const newAuthUser = authData.user;

        // 2. Insert into public.users
        return await insertPublicUser(newAuthUser.id, { full_name, email, identity_code, phone, address, role_id }, res);

    } catch (err) {
        console.error('createUser error:', err);
        return res.status(500).json({ ok: false, message: 'Internal server error' });
    }
};

/**
 * Helper to insert user into public.users table
 */
const insertPublicUser = async (userId, data, res) => {
    const { full_name, email, identity_code, phone, address, role_id } = data;
    
    const newUser = {
        id: userId, // Use the ID from Supabase Auth
        full_name,
        email,
        identity_code,
        phone,
        address,
        role_id: role_id || 3,
        status: 'active'
    };

    const { data: insertedUser, error } = await supabase
        .from('users')
        .upsert([newUser]) // Use upsert in case a trigger already created a partial record
        .select(`
            *,
            roles(id, name)
        `)
        .single();

    if (error) {
        console.error('insertPublicUser error:', error);
        return res.status(500).json({ ok: false, message: `Database Error: ${error.message}` });
    }

    return res.status(insertStatus(res)).json({
        ok: true,
        message: 'User created and synchronized successfully',
        data: insertedUser
    });
};

const insertStatus = (res) => res.req.method === 'POST' ? 201 : 200;

/**
 * PATCH /api/users/:id/status
 * Update user status - Close/Open user account (Admin/Librarian only)
 */
export const updateUserStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        // Validate status
        const validStatuses = ['active', 'inactive'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                ok: false,
                message: 'Invalid status. Must be one of: active, inactive'
            });
        }

        // Prevent admin from deactivating themselves
        if (req.user.id === id && status !== 'active') {
            return res.status(400).json({
                ok: false,
                message: 'You cannot deactivate your own account'
            });
        }

        const { data: user, error } = await supabase
            .from('users')
            .update({ status })
            .eq('id', id)
            .select(`
                *,
                roles(id, name)
            `)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({ ok: false, message: 'User not found' });
            }
            return res.status(500).json({ ok: false, message: error.message });
        }

        const actionText = status === 'active' ? 'opened' : 'closed';
        return res.status(200).json({
            ok: true,
            message: `User account ${actionText} successfully`,
            data: user
        });
    } catch (err) {
        console.error('updateUserStatus error:', err);
        return res.status(500).json({ ok: false, message: 'Internal server error' });
    }
};


/**
 * PUT /api/users/:id
 * Update user information (Admin/Librarian only)
 */
export const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            full_name,
            identity_code,
            phone,
            address,
            role_id,
            avatar_url
        } = req.body;

        const updateData = {};
        if (full_name !== undefined) updateData.full_name = full_name;
        if (identity_code !== undefined) updateData.identity_code = identity_code;
        if (phone !== undefined) updateData.phone = phone;
        if (address !== undefined) updateData.address = address;
        if (role_id !== undefined) updateData.role_id = role_id;
        if (avatar_url !== undefined) updateData.avatar_url = avatar_url;

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                ok: false,
                message: 'At least one field must be provided for update'
            });
        }

        const { data: user, error } = await supabase
            .from('users')
            .update(updateData)
            .eq('id', id)
            .select(`
                *,
                roles(id, name)
            `)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({ ok: false, message: 'User not found' });
            }
            return res.status(500).json({ ok: false, message: error.message });
        }

        return res.status(200).json({
            ok: true,
            message: 'User updated successfully',
            data: user
        });
    } catch (err) {
        console.error('updateUser error:', err);
        return res.status(500).json({ ok: false, message: 'Internal server error' });
    }
};