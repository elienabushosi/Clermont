# Email Template Configuration - Show Reset Code

## Quick Setup: Update Supabase Email Template

Since Supabase's email templates can't directly access our custom code from the URL, we have two options:

### Option 1: Use Supabase's Token (Simplest)

Supabase provides `{{ .Token }}` which is a 6-digit code. We can use this and store it in our database instead of generating our own.

**Update the email template in Supabase Dashboard:**

1. Go to **Authentication** → **Email Templates** → **Reset Password**

2. **Subject:**
```
Reset Your Password
```

3. **Body (HTML):**
```html
<h2>Password Reset Request</h2>
<p>You requested to reset your password. Use the code below:</p>

<div style="background: #f3f4f6; padding: 30px; text-align: center; margin: 30px 0; border-radius: 8px;">
  <p style="font-size: 36px; font-weight: bold; letter-spacing: 10px; color: #1f2937; margin: 0; font-family: monospace;">
    {{ .Token }}
  </p>
</div>

<p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
  Enter this code on the password reset page to create a new password.
</p>

<p style="color: #6b7280; font-size: 12px; margin-top: 20px;">
  This code will expire in 15 minutes. If you didn't request this, please ignore this email.
</p>

<p style="margin-top: 30px;">
  <a href="{{ .ConfirmationURL }}" 
     style="background-color: #37322F; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
    Or click here to reset password
  </a>
</p>
```

**Then update the backend** to use Supabase's token instead of generating our own (see Option 1 implementation below).

### Option 2: Show Custom Code in Email (Current Implementation)

To show our custom code, we need to extract it from the URL in the template. Since Go templates have limited URL parsing, we'll use a workaround:

**Update the email template:**

```html
<h2>Password Reset Request</h2>
<p>You requested to reset your password.</p>

<p><strong>Your password reset code is:</strong></p>

<div style="background: #f3f4f6; padding: 30px; text-align: center; margin: 30px 0; border-radius: 8px;">
  <p style="font-size: 36px; font-weight: bold; letter-spacing: 10px; color: #1f2937; margin: 0; font-family: monospace;">
    [Code is in the link below - click to see it]
  </p>
</div>

<p style="color: #6b7280; font-size: 14px;">
  <strong>Click the link below to go to the reset page. Your code will be automatically filled in:</strong>
</p>

<div style="text-align: center; margin: 30px 0;">
  <a href="{{ .ConfirmationURL }}" 
     style="background-color: #37322F; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
    Reset Password
  </a>
</div>

<p style="color: #6b7280; font-size: 12px; margin-top: 20px;">
  This code will expire in 15 minutes. If you didn't request this, please ignore this email.
</p>
```

**Note:** This still requires clicking the link, but the code will be pre-filled.

### Option 3: Use Custom Email Service (Best for Production)

For full control, use a service like Resend or SendGrid. This requires:
1. Setting up an email service account
2. Creating an Edge Function or updating the backend
3. Sending emails directly with the code in the body

See the implementation guide below for this option.
