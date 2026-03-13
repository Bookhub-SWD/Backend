import sgMail from '@sendgrid/mail';
import { supabase } from './supabase.js';

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL;

/**
 * Fetch all emails from the users table (people to notify).
 */
const getAllUserEmails = async () => {
  const { data, error } = await supabase
    .from('users')
    .select('email')
    .not('email', 'is', null);

  if (error) {
    console.error('Failed to fetch user emails:', error.message);
    return [];
  }
  return data.map(u => u.email).filter(Boolean);
};

/**
 * Send a notification email to all users about a new/updated post.
 * This runs asynchronously and does NOT block the HTTP response.
 *
 * @param {'create' | 'update'} action
 * @param {{ full_name: string, content: string, id: number }} post
 * @param {string} authorName
 */
export const notifyNewPost = async (action, post, authorName) => {
  try {
    const emails = await getAllUserEmails();
    if (emails.length === 0) return;

    const isCreate = action === 'create';
    const subject = isCreate
      ? `📢 [Bookhub] Thông báo mới từ ${authorName}`
      : `✏️ [Bookhub] Thông báo được cập nhật bởi ${authorName}`;

    const previewText = post.content.length > 200
      ? post.content.substring(0, 200) + '...'
      : post.content;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #4f46e5; padding: 20px 30px;">
          <h1 style="color: white; margin: 0; font-size: 22px;">📚 Bookhub</h1>
        </div>
        <div style="padding: 24px 30px;">
          <p style="color: #444; font-size: 15px; margin-top: 0;">
            ${isCreate ? 'Có thông báo/sự kiện <strong>mới</strong> vừa được đăng' : 'Một thông báo/sự kiện vừa được <strong>cập nhật</strong>'} bởi <strong>${authorName}</strong>:
          </p>
          <blockquote style="border-left: 4px solid #4f46e5; margin: 0; padding: 12px 16px; background: #f5f5ff; color: #333; font-size: 15px; border-radius: 4px;">
            ${previewText}
          </blockquote>
          <p style="margin-top: 20px; color: #888; font-size: 13px;">
            Đây là email tự động từ hệ thống Bookhub. Vui lòng không reply email này.
          </p>
        </div>
      </div>
    `;

    // SendGrid supports up to 1000 recipients per request.
    // For large lists, consider batching. For school use this is fine.
    const msg = {
      from: FROM_EMAIL,
      subject,
      html,
      personalizations: emails.map(email => ({ to: [{ email }] })),
    };

    await sgMail.send(msg);
    console.log(`[Email] Notification sent to ${emails.length} users (action: ${action})`);
  } catch (err) {
    // Do not throw — email failure should NOT break the API response
    console.error('[Email] Failed to send notification:', err.response?.body || err.message);
  }
};

/**
 * Send a notification email about a new/updated event.
 *
 * @param {'create' | 'update'} action
 * @param {{ id: number, title: string, description: string, location: string, start_time: string, end_time: string }} event
 * @param {string} authorName
 */
export const notifyEvent = async (action, event, authorName) => {
  const LIBRARY_NAME = 'Thư viện trường đại học HCM';
  try {
    const emails = await getAllUserEmails();
    if (emails.length === 0) return { sent: false, invited_recipients: 0, error: 'No users found' };

    const isCreate = action === 'create';
    const subject = isCreate
      ? `🎉 [Bookhub] Sự kiện mới: ${event.title}`
      : `📝 [Bookhub] Sự kiện được cập nhật: ${event.title}`;

    const formatDate = (iso) => {
      if (!iso) return 'N/A';
      return new Date(iso).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    };

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #4f46e5; padding: 20px 30px;">
          <h1 style="color: white; margin: 0; font-size: 22px;">📚 Bookhub</h1>
        </div>
        <div style="padding: 24px 30px;">
          <p style="color: #444; font-size: 15px; margin-top: 0;">
            ${isCreate ? '🎉 Có <strong>sự kiện mới</strong> vừa được tạo' : '📝 Một sự kiện vừa được <strong>cập nhật</strong>'} bởi <strong>${LIBRARY_NAME}</strong>:
          </p>
          <div style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px 20px; background: #f9f9ff;">
            <h2 style="margin: 0 0 12px 0; color: #4f46e5; font-size: 18px;">${event.title}</h2>
            ${event.description ? `<p style="margin: 0 0 8px 0; color: #555;">${event.description}</p>` : ''}
            <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-top: 8px;">
              ${event.location ? `<tr><td style="padding: 4px 8px 4px 0; color: #888; width: 110px;">📍 Địa điểm</td><td style="color: #333;">${event.location}</td></tr>` : ''}
              <tr><td style="padding: 4px 8px 4px 0; color: #888;">🕐 Bắt đầu</td><td style="color: #333;">${formatDate(event.start_time)}</td></tr>
              <tr><td style="padding: 4px 8px 4px 0; color: #888;">🕔 Kết thúc</td><td style="color: #333;">${formatDate(event.end_time)}</td></tr>
              ${event.max_participants ? `<tr><td style="padding: 4px 8px 4px 0; color: #888;">👥 Số chỗ</td><td style="color: #333;">${event.max_participants} người</td></tr>` : ''}
            </table>
          </div>
          <p style="margin-top: 20px; color: #888; font-size: 13px;">
            Đây là email tự động từ hệ thống Bookhub. Vui lòng không reply email này.
          </p>
        </div>
      </div>
    `;

    const msg = {
      from: FROM_EMAIL,
      subject,
      html,
      personalizations: emails.map(email => ({ to: [{ email }] })),
    };

    await sgMail.send(msg);
    console.log(`[Email] Event notification sent to ${emails.length} users (action: ${action})`);
    return { sent: true, invited_recipients: emails.length };
  } catch (err) {
    const errMsg = err.response?.body?.errors?.[0]?.message || err.message;
    console.error('[Email] Failed to send event notification:', errMsg);
    return { sent: false, invited_recipients: 0, error: errMsg };
  }
};

/**
 * Send a reminder email for a pending fine.
 */
export const sendFineReminder = async (userEmail, userName, fineDetails) => {
  try {
    const { bookTitle, amount, daysOverdue, dueDate } = fineDetails;
    
    const subject = `⚠️ [Bookhub] Nhắc nhở quá hạn trả sách: ${bookTitle}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #ef4444; padding: 20px 30px;">
          <h1 style="color: white; margin: 0; font-size: 22px;">📚 Bookhub - Nhắc nhở</h1>
        </div>
        <div style="padding: 24px 30px;">
          <p style="color: #444; font-size: 15px; margin-top: 0;">Xin chào <strong>${userName}</strong>,</p>
          <p style="color: #444; font-size: 15px;">Chúng tôi ghi nhận bạn đang có một khoản phạt chưa thanh toán cho cuốn sách:</p>
          <div style="border-left: 4px solid #ef4444; margin: 16px 0; padding: 12px 16px; background: #fff5f5; border-radius: 4px;">
            <p style="margin: 0; font-weight: bold; font-size: 16px; color: #b91c1c;">${bookTitle}</p>
            <p style="margin: 4px 0 0 0; color: #444;">Hạn trả: ${new Date(dueDate).toLocaleDateString('vi-VN')}</p>
            <p style="margin: 4px 0 0 0; color: #444;">Số ngày quá hạn: <span style="color: #ef4444; font-weight: bold;">${daysOverdue} ngày</span></p>
            <p style="margin: 4px 0 0 0; color: #444;">Số tiền phạt hiện tại: <span style="font-size: 18px; font-weight: bold;">${Number(amount).toLocaleString('vi-VN')} VND</span></p>
          </div>
          <p style="color: #444; font-size: 15px;">Vui lòng truy cập ứng dụng Bookhub để thực hiện thanh toán ngay hôm nay để tránh phát sinh thêm phí phạt (5,000 VND/ngày).</p>
          <p style="margin-top: 20px; color: #888; font-size: 13px;">Đây là email tự động từ hệ thống Bookhub. Vui lòng không reply email này.</p>
        </div>
      </div>
    `;

    const msg = {
      to: userEmail,
      from: FROM_EMAIL,
      subject,
      html,
    };

    await sgMail.send(msg);
    console.log(`[Email] Fine reminder sent to ${userEmail}`);
    return { success: true };
  } catch (err) {
    console.error('[Email] Failed to send fine reminder:', err.message);
    return { success: false, error: err.message };
  }
};

/**
 * Send a detailed invoice email for a successful fine payment.
 */
export const sendFineInvoice = async (userEmail, userName, paymentDetails) => {
  try {
    const { fineId, bookTitle, amount, paidAt, returnDate } = paymentDetails;
    
    const subject = `✅ [Bookhub] Hóa đơn thanh toán phí phạt #${fineId}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #10b981; padding: 20px 30px;">
          <h1 style="color: white; margin: 0; font-size: 22px;">📚 Bookhub - Hóa đơn</h1>
        </div>
        <div style="padding: 24px 30px;">
          <p style="color: #444; font-size: 15px; margin-top: 0;">Xin chào <strong>${userName}</strong>,</p>
          <p style="color: #444; font-size: 15px;">Bạn đã thanh toán thành công khoản phí phạt cho mượn sách. Dưới đây là biên lai chi tiết:</p>
          
          <div style="border: 1px solid #e2e8f0; border-radius: 8px; margin: 20px 0; padding: 20px;">
            <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px 0; color: #64748b;">Mã hóa đơn</td>
                <td style="padding: 8px 0; text-align: right; font-weight: bold;">#${fineId}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px 0; color: #64748b;">Sách đã mượn</td>
                <td style="padding: 8px 0; text-align: right; font-weight: bold;">${bookTitle}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px 0; color: #64748b;">Ngày trả sách</td>
                <td style="padding: 8px 0; text-align: right;">${new Date(returnDate).toLocaleDateString('vi-VN')}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px 0; color: #64748b;">Ngày thanh toán</td>
                <td style="padding: 8px 0; text-align: right;">${new Date(paidAt).toLocaleDateString('vi-VN')}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0 0 0; color: #1a1a1a; font-weight: bold; font-size: 16px;">Tổng cộng</td>
                <td style="padding: 12px 0 0 0; text-align: right; color: #10b981; font-weight: bold; font-size: 20px;">${Number(amount).toLocaleString('vi-VN')} VND</td>
              </tr>
            </table>
          </div>
          
          <p style="color: #444; font-size: 15px;">Cảm ơn bạn đã sử dụng dịch vụ của thư viện Bookhub!</p>
          <p style="margin-top: 20px; color: #888; font-size: 13px;">Email này có giá trị như một biên lai điện tử.</p>
        </div>
      </div>
    `;

    const msg = {
      to: userEmail,
      from: FROM_EMAIL,
      subject,
      html,
    };

    await sgMail.send(msg);
    console.log(`[Email] Payment invoice sent to ${userEmail}`);
    return { success: true };
  } catch (err) {
    console.error('[Email] Failed to send payment invoice:', err.message);
    return { success: false, error: err.message };
  }
};
