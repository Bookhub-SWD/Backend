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
      .select('id, full_name, email, identity_code, address, status, roles(id, name)')
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
