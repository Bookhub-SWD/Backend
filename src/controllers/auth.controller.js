import { supabase } from '../lib/supabase.js';

export const googleLogin = async (req, res) => {
  try {
    const { access_token } = req.body;
    if (!access_token) {
      return res.status(400).json({ ok: false, message: 'access_token is required' });
    }
    // 1. Verify token với Supabase → lấy user info từ Google
    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData?.user) {
      return res.status(401).json({ ok: false, message: 'Invalid or expired token' });
    }
    const email = authData.user.email;
    const authUserId = authData.user.id;

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, full_name, email, identity_code, address, status, avatar_url, roles(id, name)')
      .eq('id', authUserId)
      .single();

    if (userError || !user) {
      return res.status(401).json({
        ok: false,
        message: 'Unauthorized: Your account is not registered in the system',
      });
    }
    if (user.status !== 'active') {
      return res.status(403).json({
        ok: false,
        message: 'Your account has been deactivated. Please contact administrator.',
      });
    }

    // 4. Trả về thông tin user + token để frontend lưu
    return res.status(200).json({
      ok: true,
      message: 'Login successful',
      data: {
        access_token,
        user: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          identity_code: user.identity_code,
          address: user.address,
          avatar_url: user.avatar_url,
          roles: user.roles,  // "roles" matches hasRole() check in frontend auth.ts
        },
      },
    });
  } catch (err) {
    console.error('googleLogin error:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

/**
 * GET /api/auth/me
 * Header: Authorization: Bearer <access_token>
 *
 * Trả về thông tin user hiện tại dựa theo token.
 */
export const getMe = async (req, res) => {
  return res.status(200).json({
    ok: true,
    data: { user: req.user },
  });
};

/**
 * PATCH /api/auth/me
 * Update current user's profile (name, avatar)
 */
export const updateMe = async (req, res) => {
  try {
    const userId = req.user.id;
    const { full_name, avatar_url } = req.body;

    const updateData = {};
    if (full_name !== undefined) updateData.full_name = full_name;
    if (avatar_url !== undefined) updateData.avatar_url = avatar_url;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ ok: false, message: 'No data to update' });
    }

    const { data: updatedUser, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select('id, full_name, email, identity_code, address, status, avatar_url, roles(id, name)')
      .single();

    if (error) {
      return res.status(500).json({ ok: false, message: error.message });
    }

    return res.status(200).json({
      ok: true,
      message: 'Profile updated successfully',
      data: { user: updatedUser }
    });
  } catch (err) {
    console.error('updateMe error:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

/**
 * POST /api/auth/avatar
 * Upload avatar image to Supabase Storage via Backend (bypass RLS)
 */
export const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, message: 'No file uploaded' });
    }

    const file = req.file;
    const userId = req.user.id;
    const fileExt = file.originalname.split('.').pop() || 'jpg';
    const fileName = `${userId}-${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    // Upload to Supabase Storage using service role client (bypass RLS)
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true
      });

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      return res.status(500).json({ ok: false, message: uploadError.message });
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    return res.status(200).json({
      ok: true,
      message: 'Avatar uploaded successfully',
      data: { publicUrl }
    });
  } catch (err) {
    console.error('uploadAvatar error:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};
