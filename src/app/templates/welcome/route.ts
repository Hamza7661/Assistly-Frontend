import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const baseUrl = new URL(request.url).origin;

  const userName = searchParams.get('userName') || 'User';
  const userEmail = searchParams.get('userEmail') || 'user@example.com';
  const dashboardUrl = searchParams.get('dashboardUrl') || `${baseUrl}/dashboard`;
  const supportEmail = searchParams.get('supportEmail') || 'support@upzilo.com';

  const htmlTemplate = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to UpZilo</title>
  <style>
    body {
      font-family: 'Poppins', Arial, sans-serif;
      margin: 0;
      padding: 0;
      background-color: #f3f4f6;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    .header {
      background: #ffffff;
      padding: 1.5rem 2rem 1.25rem;
      text-align: center;
      border-bottom: 4px solid #a32035;
    }
    .logo {
      margin-bottom: 0.5rem;
    }
    .logoImage {
      width: 180px;
      max-width: 100%;
      height: auto;
      display: block;
      margin: 0 auto;
    }
    .tagline {
      color: #7f1727;
      font-size: 1rem;
      font-weight: 600;
      margin: 0;
    }
    .content {
      padding: 2.25rem 2rem;
      text-align: center;
    }
    .title {
      color: #1f2937;
      font-size: 1.75rem;
      font-weight: 700;
      margin: 0 0 1rem 0;
    }
    .message {
      color: #4b5563;
      font-size: 1rem;
      line-height: 1.7;
      margin: 0 0 1.5rem 0;
    }
    .highlightBox {
      background: #fff5f7;
      border: 1px solid #f4c2cc;
      border-radius: 8px;
      padding: 1rem;
      margin: 1rem 0 1.75rem 0;
      color: #7f1727;
      font-size: 0.95rem;
      line-height: 1.6;
    }
    .ctaButton {
      display: inline-block;
      background: linear-gradient(135deg, #a32035 0%, #7f1727 100%);
      color: #ffffff !important;
      text-decoration: none !important;
      padding: 0.95rem 2rem;
      border-radius: 10px;
      font-weight: 700;
      font-size: 1rem;
      margin: 0.75rem 0 0.5rem 0;
      box-shadow: 0 8px 18px rgba(127, 23, 39, 0.2);
    }
    .subText {
      color: #6b7280;
      font-size: 0.9rem;
      margin-top: 0.75rem;
    }
    .footer {
      background: #f8fafc;
      padding: 1.5rem;
      text-align: center;
      color: #6b7280;
      font-size: 0.875rem;
      border-top: 1px solid #e5e7eb;
    }
    .footer p {
      margin: 0.35rem 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">
        <img src="${baseUrl}/assistly-logo-v3.png" alt="Assistly logo" class="logoImage">
      </div>
      <p class="tagline">UpZilo - Your Virtual Assistant Platform</p>
    </div>

    <div class="content">
      <h1 class="title">Welcome to UpZilo, ${userName}!</h1>
      <p class="message">
        Your email has been verified successfully and your portal is now ready.
        We are excited to have you on board.
      </p>

      <div class="highlightBox">
        You can now access your dashboard, configure your assistant, and start managing leads and conversations from one place.
      </div>

      <a href="${dashboardUrl}" class="ctaButton">Go To Your Portal</a>
      <p class="subText">If the button does not work, use this link: ${dashboardUrl}</p>
    </div>

    <div class="footer">
      <p>© 2025 UpZilo. All rights reserved.</p>
      <p>This email was sent to ${userEmail}</p>
      <p>Need help? Contact us at ${supportEmail}</p>
    </div>
  </div>
</body>
</html>
  `;

  return new NextResponse(htmlTemplate, {
    headers: {
      'Content-Type': 'text/html',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
