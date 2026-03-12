import { supabase, supabaseAnon } from '../lib/supabase.js';

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
    const { data: authData, error: authError } = await supabaseAnon.auth.getUser(token);

    if (authError || !authData?.user) {
      return res.status(401).json({ ok: false, message: 'Invalid or expired token' });
    }

    const authUserId = authData.user.id;

    // Kiểm tra user trong public.users theo ID của auth
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

    // Attach user info vào request để dùng ở các route sau
    req.user = user;
    next();
  } catch (err) {
    console.error('authenticate middleware error:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

/**
 * Middleware kiểm tra session toàn cục (soft validation).
 * Nếu có token, kiểm tra tính hợp lệ và trạng thái tài khoản.
 * Nếu không có token, cho phép đi tiếp (guest access).
 */
export const validateSession = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // Nếu không có header Authorization, cho phép đi tiếp (Guest)
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];

    // Verify token với Supabase
    const { data: authData, error: authError } = await supabaseAnon.auth.getUser(token);

    if (authError || !authData?.user) {
      return res.status(401).json({ ok: false, message: 'Invalid or expired session' });
    }

    // Kiểm tra trạng thái user trong database
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, status, avatar_url, roles(id, name)')
      .eq('id', authData.user.id)
      .single();

    if (userError || !user) {
      return res.status(401).json({ ok: false, message: 'Account not found' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({
        ok: false,
        message: 'Your account has been deactivated. Please contact administrator.',
      });
    }

    // Attach minimal user info
    req.user = user;
    next();
  } catch (err) {
    console.error('validateSession error:', err);
    next(); // Trong trường hợp lỗi bất ngờ, cho phép request đi tiếp hoặc handle tùy policy
  }
};

/**
 * Middleware kiểm tra quyền admin/librarian.
 * Yêu cầu req.user đã được attach từ authenticate middleware.
 */
export const isInternal = (req, res, next) => {
  if (!req.user || !req.user.roles) {
    return res.status(403).json({ ok: false, message: 'Forbidden: No user roles found' });
  }

  const roleName = req.user.roles.name.toLowerCase();
  if (roleName !== 'admin' && roleName !== 'librarian') {
    return res.status(403).json({ ok: false, message: 'Forbidden: You do not have permission to access this resource' });
  }

  next();
};

/**
 * Middleware kiểm tra quyền admin.
 * Yêu cầu req.user đã được attach từ authenticate middleware.
 */
export const isAdmin = (req, res, next) => {
  if (!req.user || !req.user.roles) {
    return res.status(403).json({ ok: false, message: 'Forbidden: No user roles found' });
  }

  const roleName = req.user.roles.name.toLowerCase();
  if (roleName !== 'admin') {
    return res.status(403).json({ ok: false, message: 'Forbidden: Admin access required' });
  }

  next();
};
