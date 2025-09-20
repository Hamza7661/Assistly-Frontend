import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  // Extract parameters from query string
  const otp = searchParams.get('otp') || '{{OTP}}';
  const customerName = searchParams.get('customerName') || '{{CUSTOMER_NAME}}';
  
  const htmlTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OTP Verification - Assistly</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        :root {
            --primary-color: #ffffff;
            --secondary-color: #00bc7d;
            --text-primary: #1f2937;
            --text-secondary: #6b7280;
            --border-color: #e5e7eb;
            --background-light: #f9fafb;
        }
        
        body {
            font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background-color: var(--background-light);
            padding: 20px;
            line-height: 1.6;
            color: var(--text-primary);
        }
        
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: var(--primary-color);
            border-radius: 12px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            overflow: hidden;
            border: 1px solid var(--border-color);
        }
        
        .header {
            background: linear-gradient(135deg, var(--secondary-color), #00a06a);
            padding: 30px 20px;
            text-align: center;
            color: var(--primary-color);
        }
        
        .logo {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            margin: 0 auto 15px;
            background: var(--primary-color);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            font-weight: bold;
            color: var(--secondary-color);
        }
        
        .company-name {
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 5px;
        }
        
        .content {
            padding: 40px 30px;
        }
        
        .title {
            font-size: 28px;
            font-weight: 700;
            color: var(--text-primary);
            text-align: center;
            margin-bottom: 20px;
        }
        
        .message {
            font-size: 16px;
            color: var(--text-secondary);
            text-align: center;
            margin-bottom: 30px;
        }
        
        .otp-container {
            text-align: center;
            margin: 30px 0;
        }
        
        .otp-label {
            font-size: 14px;
            color: var(--text-secondary);
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 1px;
            font-weight: 500;
        }
        
        .otp-code {
            font-size: 36px;
            font-weight: 700;
            color: var(--secondary-color);
            background: #f3f4f6;
            padding: 20px 30px;
            border-radius: 8px;
            border: 2px dashed var(--secondary-color);
            letter-spacing: 8px;
            font-family: 'Courier New', monospace;
            display: inline-block;
            margin: 10px 0;
        }
        
        .info-box {
            background: #f0f9ff;
            border: 1px solid #0ea5e9;
            border-radius: 8px;
            padding: 20px;
            margin: 30px 0;
        }
        
        .info-title {
            font-weight: 600;
            color: #0369a1;
            margin-bottom: 10px;
            display: flex;
            align-items: center;
        }
        
        .info-title::before {
            content: "ℹ️";
            margin-right: 8px;
        }
        
        .info-text {
            color: #0369a1;
            font-size: 14px;
        }
        
        .footer {
            background: var(--background-light);
            padding: 20px 30px;
            text-align: center;
            border-top: 1px solid var(--border-color);
        }
        
        .footer-text {
            font-size: 12px;
            color: var(--text-secondary);
            margin-bottom: 10px;
        }
        
        .expiry-notice {
            background: #fef3c7;
            border: 1px solid #f59e0b;
            border-radius: 6px;
            padding: 15px;
            margin: 20px 0;
            text-align: center;
        }
        
        .expiry-text {
            color: #92400e;
            font-size: 14px;
            font-weight: 500;
        }
        
        @media (max-width: 600px) {
            .container {
                margin: 10px;
                border-radius: 8px;
            }
            
            .content {
                padding: 30px 20px;
            }
            
            .title {
                font-size: 24px;
            }
            
            .otp-code {
                font-size: 28px;
                padding: 15px 20px;
                letter-spacing: 6px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">A</div>
            <div class="company-name">Assistly</div>
        </div>
        
        <div class="content">
            <h1 class="title">Verify Your Account</h1>
            
            <p class="message">
                Hello ${customerName},<br>
                Please use the verification code below to complete your account setup.
            </p>
            
            <div class="otp-container">
                <div class="otp-label">Verification Code</div>
                <div class="otp-code">${otp}</div>
            </div>
            
            <div class="expiry-notice">
                <div class="expiry-text">⏰ This code will expire in 10 minutes</div>
            </div>
            
            <div class="info-box">
                <div class="info-title">Important Security Information</div>
                <div class="info-text">
                    • Never share this code with anyone<br>
                    • Our team will never ask for your verification code<br>
                    • If you didn't request this code, please ignore this email
                </div>
            </div>
        </div>
        
        <div class="footer">
            <div class="footer-text">
                This is an automated message from Assistly
            </div>
            <div class="footer-text">
                If you have any questions, please contact our support team.
            </div>
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
