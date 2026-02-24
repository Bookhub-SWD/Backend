import { supabase } from '../lib/supabase.js';

/**
 * Middleware xác thực token cho các route yêu cầu đăng nhập.
 * Yêu cầu header: Authorization: Bearer <access_token>
 * Nếu hợp lệ, attach req.user với thông tin từ public.users.
 */
export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ ok: false, message: 'Missing or invalid Authorization header' });
    }

    const token = authHeader.split(' ')[1];

    // Verify token với Supabase
    const { data: authData, error: authError } = await supabase.auth.getUser(token);

    if (authError || !authData?.user) {
      return res.status(401).json({ ok: false, message: 'Invalid or expired token' });
    }

    const email = authData.user.email;

    // Kiểm tra email trong public.users
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('user_id, full_name, email, identity_code, address, status, roles(id, name)')
      .eq('email', email)
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

    // Attach user info vào request để dùng ở các route sau
    req.user = user;
    next();
  } catch (err) {
    console.error('authenticate middleware error:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};
