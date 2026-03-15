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

        if (!supabase.auth.admin) {
            return res.status(500).json({ 
                ok: false, 
                message: 'Supabase Service Role Key is missing.' 
            });
        }

        const randomPassword = Math.random().toString(36).slice(-12) + 'K1!';
        
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email,
            password: randomPassword,
            email_confirm: true,
            user_metadata: { full_name }
        });

        if (authError) {
            if (authError.message.includes('already registered') || authError.status === 422) {
                const { data: existingUsers } = await supabase.auth.admin.listUsers();
                const existingAuthUser = existingUsers?.users?.find(u => u.email === email);
                if (existingAuthUser) {
                    const { data: publicUser } = await supabase
                        .from('users')
                        .select('id')
                        .eq('id', existingAuthUser.id)
                        .maybeSingle();
                    
                    if (publicUser) {
                        return res.status(400).json({ ok: false, message: 'User already exists' });
                    }
                    return await insertPublicUser(existingAuthUser.id, { full_name, email, identity_code, phone, address, role_id }, res);
                }
            }
            return res.status(400).json({ ok: false, message: authError.message });
        }

        return await insertPublicUser(authData.user.id, { full_name, email, identity_code, phone, address, role_id }, res);

    } catch (err) {
        console.error('createUser error:', err);
        return res.status(500).json({ ok: false, message: 'Internal server error' });
    }
};

const insertPublicUser = async (userId, data, res) => {
    const { full_name, email, identity_code, phone, address, role_id } = data;
    const { data: insertedUser, error } = await supabase
        .from('users')
        .upsert([{
            id: userId,
            full_name,
            email,
            identity_code,
            phone,
            address,
            role_id: role_id || 1,
            status: 'active'
        }])
        .select(`*, roles(id, name)`)
        .single();

    if (error) return res.status(500).json({ ok: false, message: error.message });
    return res.status(res.req.method === 'POST' ? 201 : 200).json({
        ok: true,
        message: 'User synchronized successfully',
        data: insertedUser
    });
};

/**
 * PATCH /api/users/:id/status
 */
export const updateUserStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const { data: user, error } = await supabase
            .from('users')
            .update({ status })
            .eq('id', id)
            .select(`*, roles(id, name)`)
            .single();

        if (error) return res.status(500).json({ ok: false, message: error.message });
        return res.status(200).json({ ok: true, message: 'Status updated', data: user });
    } catch (err) {
        return res.status(500).json({ ok: false, message: 'Internal server error' });
    }
};

/**
 * PUT /api/users/:id
 */
export const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { full_name, identity_code, phone, address, role_id } = req.body;

        const { data: user, error } = await supabase
            .from('users')
            .update({ full_name, identity_code, phone, address, role_id })
            .eq('id', id)
            .select(`*, roles(id, name)`)
            .single();

        if (error) return res.status(500).json({ ok: false, message: error.message });
        return res.status(200).json({ ok: true, message: 'User updated', data: user });
    } catch (err) {
        return res.status(500).json({ ok: false, message: 'Internal server error' });
    }
};

/**
 * GET /api/users/stats
 * Get user statistics
 */
export const getUserStats = async (req, res) => {
    try {
        const { data: users, error } = await supabase
            .from('users')
            .select('role_id, status, roles(name)');

        if (error) return res.status(500).json({ ok: false, message: error.message });

        const roleCounts = {};
        const statusCounts = { active: 0, inactive: 0 };
        
        users.forEach(u => {
            const roleName = u.roles?.name || 'Unknown';
            roleCounts[roleName] = (roleCounts[roleName] || 0) + 1;
            statusCounts[u.status] = (statusCounts[u.status] || 0) + 1;
        });

        const totalUsers = users.length;
        const { count: overdueCount } = await supabase
            .from('borrow_records')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'overdue');

        return res.status(200).json({
            ok: true,
            data: {
                total_users: totalUsers,
                active_users: statusCounts.active,
                overdue_users: overdueCount || 0,
                role_distribution: Object.entries(roleCounts).map(([name, count]) => ({
                    name,
                    count,
                    percentage: totalUsers > 0 ? Math.round((count / totalUsers) * 100) : 0
                })),
                status_distribution: statusCounts
            }
        });
    } catch (err) {
        return res.status(500).json({ ok: false, message: 'Internal server error' });
    }
};