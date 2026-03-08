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
 * POST /api/users/:id/reset-password
 * Reset user password (Admin/Librarian only)
 */
export const resetUserPassword = async (req, res) => {
    try {
        const { id } = req.params;
        const { new_password } = req.body;

        if (!new_password) {
            return res.status(400).json({
                ok: false,
                message: 'new_password is required'
            });
        }

        if (new_password.length < 6) {
            return res.status(400).json({
                ok: false,
                message: 'Password must be at least 6 characters long'
            });
        }

        // Check if user exists in our database
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', id)
            .single();

        if (userError) {
            if (userError.code === 'PGRST116') {
                return res.status(404).json({ ok: false, message: 'User not found' });
            }
            return res.status(500).json({ ok: false, message: userError.message });
        }

        // Update password in Supabase auth
        const { error: authError } = await supabase.auth.admin.updateUserById(
            id,
            { password: new_password }
        );

        if (authError) {
            return res.status(500).json({
                ok: false,
                message: 'Failed to reset password: ' + authError.message
            });
        }

        return res.status(200).json({
            ok: true,
            message: 'Password reset successfully'
        });
    } catch (err) {
        console.error('resetUserPassword error:', err);
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
            role_id
        } = req.body;

        const updateData = {};
        if (full_name !== undefined) updateData.full_name = full_name;
        if (identity_code !== undefined) updateData.identity_code = identity_code;
        if (phone !== undefined) updateData.phone = phone;
        if (address !== undefined) updateData.address = address;
        if (role_id !== undefined) updateData.role_id = role_id;

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