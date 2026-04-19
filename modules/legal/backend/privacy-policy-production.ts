/**
 * PRODUCTION-READY PRIVACY POLICY
 * Meta WhatsApp Business Platform Compliant
 * Professional SaaS Legal Document
 */

export const PRIVACY_POLICY_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Privacy Policy - WhatsApp Business CRM Platform</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.7; 
            color: #2c3e50; 
            background: #f8f9fa;
            padding: 20px;
        }
        .container { 
            max-width: 900px; 
            margin: 0 auto; 
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px;
            text-align: center;
        }
        .header h1 { 
            font-size: 2.5rem; 
            font-weight: 700;
            margin-bottom: 10px;
        }
        .header p { 
            font-size: 1.1rem; 
            opacity: 0.9;
        }
        .content { 
            padding: 40px;
        }
        .last-updated { 
            background: #e3f2fd; 
            padding: 20px; 
            border-radius: 8px; 
            margin-bottom: 30px;
            border-left: 4px solid #2196f3;
        }
        .last-updated strong { 
            color: #1976d2;
            font-size: 1.1rem;
        }
        h2 { 
            color: #1a73e8; 
            font-size: 1.8rem;
            margin: 40px 0 20px 0;
            padding-bottom: 10px;
            border-bottom: 2px solid #e8f0fe;
        }
        h3 { 
            color: #34495e; 
            font-size: 1.3rem;
            margin: 25px 0 15px 0;
        }
        p { 
            margin-bottom: 15px; 
            font-size: 1rem;
        }
        ul, ol { 
            margin: 15px 0 15px 30px;
        }
        li { 
            margin-bottom: 8px;
            font-size: 1rem;
        }
        .highlight-box { 
            background: #fff3e0; 
            padding: 20px; 
            border-radius: 8px; 
            margin: 20px 0;
            border-left: 4px solid #ff9800;
        }
        .security-box { 
            background: #e8f5e8; 
            padding: 20px; 
            border-radius: 8px; 
            margin: 20px 0;
            border-left: 4px solid #4caf50;
        }
        .contact-box { 
            background: #f3e5f5; 
            padding: 25px; 
            border-radius: 8px; 
            margin: 30px 0;
            border-left: 4px solid #9c27b0;
        }
        .contact-box h3 { 
            color: #7b1fa2;
            margin-top: 0;
        }
        strong { 
            color: #2c3e50;
            font-weight: 600;
        }
        .meta-compliance {
            background: #e8f4fd;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            border-left: 4px solid #1877f2;
        }
        .footer {
            background: #263238;
            color: white;
            padding: 30px;
            text-align: center;
        }
        .footer p {
            opacity: 0.8;
            margin: 0;
        }
        @media (max-width: 768px) {
            .container { margin: 10px; }
            .header, .content { padding: 20px; }
            .header h1 { font-size: 2rem; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Privacy Policy</h1>
            <p>Your privacy is our priority. We're committed to protecting your data and being transparent about our practices.</p>
        </div>
        
        <div class="content">
            <div class="last-updated">
                <strong>Last Updated:</strong> ${new Date().toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                })}
                <br><strong>Effective Date:</strong> ${new Date().toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                })}
            </div>

            <h2>1. Introduction</h2>
            <p>Welcome to our WhatsApp Business CRM Platform ("we," "our," or "us"). We are a Software-as-a-Service (SaaS) platform that enables businesses to manage customer communications through WhatsApp Business API integration.</p>
            
            <p><strong>Our Services Include:</strong></p>
            <ul>
                <li>WhatsApp Business API integration and management</li>
                <li>Customer relationship management (CRM) tools</li>
                <li>Multi-channel messaging platform</li>
                <li>Analytics and reporting dashboard</li>
                <li>Team collaboration and workflow automation</li>
            </ul>

            <p>This Privacy Policy explains how we collect, use, protect, and share your information when you use our platform. By using our services, you agree to the collection and use of information in accordance with this policy.</p>

            <div class="meta-compliance">
                <strong>Meta WhatsApp Business Platform Compliance:</strong> Our platform is designed to comply with Meta's WhatsApp Business Platform policies and requirements. We ensure proper handling of WhatsApp data and maintain the security standards required for Business Solution Provider (BSP) certification.
            </div>

            <h2>2. Information We Collect</h2>

            <h3>2.1 Account Information</h3>
            <p>When you create an account with us, we collect:</p>
            <ul>
                <li><strong>Personal Details:</strong> Name, email address, phone number</li>
                <li><strong>Business Information:</strong> Company name, business address, industry type</li>
                <li><strong>Authentication Data:</strong> Password (encrypted), security preferences</li>
                <li><strong>Billing Information:</strong> Payment details, subscription plan, billing address</li>
            </ul>

            <h3>2.2 WhatsApp Business Integration Data</h3>
            <p>To provide WhatsApp messaging services, we collect:</p>
            <ul>
                <li><strong>Facebook Business Manager Information:</strong> Business Manager ID, associated Facebook accounts</li>
                <li><strong>WhatsApp Business Account Details:</strong> WhatsApp Business Account ID (WABA), phone number ID</li>
                <li><strong>API Credentials:</strong> Access tokens (encrypted), webhook configurations</li>
                <li><strong>Phone Number Information:</strong> Business phone numbers, verification status</li>
            </ul>

            <h3>2.3 Communication Data</h3>
            <p>For message delivery and platform functionality, we process:</p>
            <ul>
                <li><strong>Message Content:</strong> Text messages, media files, templates sent through our platform</li>
                <li><strong>Contact Information:</strong> Customer phone numbers, names, conversation history</li>
                <li><strong>Message Metadata:</strong> Delivery status, timestamps, message IDs</li>
                <li><strong>Conversation Analytics:</strong> Response rates, engagement metrics (aggregated)</li>
            </ul>

            <div class="highlight-box">
                <strong>Important:</strong> We only process message data to provide our services. We do not read, analyze, or use your message content for any purpose other than delivery and platform functionality. Your conversations remain private between you and your customers.
            </div>

            <h3>2.4 Usage and Technical Data</h3>
            <ul>
                <li><strong>Platform Usage:</strong> Features used, login frequency, session duration</li>
                <li><strong>Device Information:</strong> Browser type, operating system, IP address</li>
                <li><strong>Performance Data:</strong> API response times, error logs, system performance metrics</li>
                <li><strong>Security Logs:</strong> Login attempts, security events, access patterns</li>
            </ul>

            <h2>3. How We Use Your Information</h2>

            <h3>3.1 Service Provision</h3>
            <ul>
                <li><strong>WhatsApp Integration:</strong> Connect and manage your WhatsApp Business API</li>
                <li><strong>Message Delivery:</strong> Send and receive messages on your behalf</li>
                <li><strong>Contact Management:</strong> Organize and manage your customer contacts</li>
                <li><strong>Analytics:</strong> Provide insights into your messaging performance</li>
            </ul>

            <h3>3.2 Platform Improvement</h3>
            <ul>
                <li><strong>Feature Development:</strong> Analyze usage patterns to improve our platform</li>
                <li><strong>Performance Optimization:</strong> Monitor and enhance system performance</li>
                <li><strong>Bug Fixes:</strong> Identify and resolve technical issues</li>
                <li><strong>Security Enhancement:</strong> Detect and prevent security threats</li>
            </ul>

            <h3>3.3 Communication and Support</h3>
            <ul>
                <li><strong>Customer Support:</strong> Respond to your questions and provide assistance</li>
                <li><strong>Service Updates:</strong> Notify you about platform updates and new features</li>
                <li><strong>Billing:</strong> Process payments and send billing notifications</li>
                <li><strong>Legal Compliance:</strong> Comply with legal obligations and enforce our terms</li>
            </ul>

            <h2>4. Data Sharing and Disclosure</h2>

            <p><strong>We do not sell your personal information.</strong> We may share your information only in the following circumstances:</p>

            <h3>4.1 With Meta (Facebook/WhatsApp)</h3>
            <ul>
                <li><strong>API Integration:</strong> Share necessary data to enable WhatsApp Business API functionality</li>
                <li><strong>Compliance:</strong> Ensure compliance with Meta's WhatsApp Business Platform policies</li>
                <li><strong>Message Delivery:</strong> Transmit messages through WhatsApp's infrastructure</li>
            </ul>

            <h3>4.2 Service Providers</h3>
            <p>We work with trusted third-party service providers who assist us in:</p>
            <ul>
                <li><strong>Cloud Infrastructure:</strong> Secure hosting and data storage</li>
                <li><strong>Payment Processing:</strong> Secure payment transactions</li>
                <li><strong>Analytics:</strong> Platform performance monitoring</li>
                <li><strong>Customer Support:</strong> Help desk and support services</li>
            </ul>

            <p>All service providers are contractually bound to protect your data and use it only for the specified purposes.</p>

            <h3>4.3 Legal Requirements</h3>
            <p>We may disclose your information when required by law or to:</p>
            <ul>
                <li>Comply with legal processes or government requests</li>
                <li>Protect our rights, property, or safety</li>
                <li>Prevent fraud or security threats</li>
                <li>Enforce our Terms of Service</li>
            </ul>

            <h3>4.4 Business Transfers</h3>
            <p>In the event of a merger, acquisition, or sale of assets, your information may be transferred as part of the business transaction. We will notify you of any such change in ownership or control.</p>

            <h2>5. Data Security</h2>

            <div class="security-box">
                <h3>Our Security Measures</h3>
                <p>We implement industry-standard security practices to protect your data:</p>
                
                <h4>Technical Safeguards:</h4>
                <ul>
                    <li><strong>Encryption:</strong> All data encrypted in transit (TLS 1.3) and at rest (AES-256)</li>
                    <li><strong>Access Controls:</strong> Role-based access with multi-factor authentication</li>
                    <li><strong>Network Security:</strong> Firewalls, intrusion detection, and secure protocols</li>
                    <li><strong>Regular Audits:</strong> Security assessments and vulnerability testing</li>
                </ul>

                <h4>Organizational Safeguards:</h4>
                <ul>
                    <li><strong>Staff Training:</strong> Regular security and privacy training for all employees</li>
                    <li><strong>Access Management:</strong> Principle of least privilege and regular access reviews</li>
                    <li><strong>Incident Response:</strong> Documented procedures for security incidents</li>
                    <li><strong>Vendor Management:</strong> Due diligence on all third-party providers</li>
                </ul>
            </div>

            <p><strong>Data Breach Notification:</strong> In the unlikely event of a data breach that affects your personal information, we will notify you within 72 hours and provide details about the incident and steps we're taking to address it.</p>

            <h2>6. Your Rights and Choices</h2>

            <h3>6.1 Access and Control</h3>
            <p>You have the right to:</p>
            <ul>
                <li><strong>Access:</strong> Request copies of your personal information</li>
                <li><strong>Correction:</strong> Update or correct inaccurate information</li>
                <li><strong>Deletion:</strong> Request deletion of your personal information</li>
                <li><strong>Portability:</strong> Export your data in a machine-readable format</li>
                <li><strong>Restriction:</strong> Limit how we process your information</li>
                <li><strong>Objection:</strong> Object to certain types of processing</li>
            </ul>

            <h3>6.2 Communication Preferences</h3>
            <ul>
                <li><strong>Marketing Emails:</strong> Unsubscribe from promotional communications</li>
                <li><strong>Service Notifications:</strong> Control non-essential service updates</li>
                <li><strong>WhatsApp Messages:</strong> Manage your WhatsApp messaging preferences</li>
            </ul>

            <h3>6.3 Account Management</h3>
            <ul>
                <li><strong>Account Deletion:</strong> Delete your account and associated data</li>
                <li><strong>Data Export:</strong> Download your data before account closure</li>
                <li><strong>Subscription Control:</strong> Modify or cancel your subscription</li>
            </ul>

            <div class="highlight-box">
                <strong>How to Exercise Your Rights:</strong> Contact us at privacy@yourcompany.com or use the privacy controls in your account dashboard. We will respond to your request within 30 days.
            </div>

            <h2>7. Data Retention</h2>

            <p>We retain your information for as long as necessary to provide our services and comply with legal obligations:</p>

            <ul>
                <li><strong>Account Data:</strong> Retained while your account is active and for 90 days after closure</li>
                <li><strong>Message Data:</strong> Retained for 90 days unless you request longer retention</li>
                <li><strong>Compliance Logs:</strong> Retained for 2 years for audit and compliance purposes</li>
                <li><strong>Opt-in Records:</strong> Retained indefinitely for WhatsApp compliance verification</li>
                <li><strong>Billing Data:</strong> Retained for 7 years for accounting and tax purposes</li>
                <li><strong>Security Logs:</strong> Retained for 1 year for security monitoring</li>
            </ul>

            <p>After the retention period, we securely delete or anonymize your information. Some information may be retained longer if required by law or for legitimate business purposes.</p>

            <h2>8. Third-Party Services</h2>

            <h3>8.1 Meta (Facebook/WhatsApp)</h3>
            <p>Our platform integrates with Meta's services:</p>
            <ul>
                <li><strong>WhatsApp Business API:</strong> For message delivery and management</li>
                <li><strong>Facebook Business Manager:</strong> For account and business verification</li>
                <li><strong>Meta's Privacy Policy:</strong> Also applies to data processed through their services</li>
            </ul>

            <h3>8.2 Other Integrations</h3>
            <p>We may offer integrations with other business tools. Each integration is governed by the respective service's privacy policy and our data processing agreements.</p>

            <h2>9. Cookies and Tracking</h2>

            <p>We use cookies and similar technologies to:</p>
            <ul>
                <li><strong>Essential Cookies:</strong> Enable core platform functionality and security</li>
                <li><strong>Performance Cookies:</strong> Monitor platform performance and user experience</li>
                <li><strong>Functional Cookies:</strong> Remember your preferences and settings</li>
            </ul>

            <p>You can control cookies through your browser settings. Disabling essential cookies may affect platform functionality.</p>

            <h2>10. International Data Transfers</h2>

            <p>Your information may be transferred to and processed in countries other than your own. We ensure appropriate safeguards are in place:</p>
            <ul>
                <li><strong>Adequacy Decisions:</strong> Transfers to countries with adequate protection</li>
                <li><strong>Standard Contractual Clauses:</strong> EU-approved contracts for international transfers</li>
                <li><strong>Certification Schemes:</strong> Recognized privacy certification programs</li>
            </ul>

            <h2>11. Children's Privacy</h2>

            <p>Our services are not intended for individuals under 16 years of age. We do not knowingly collect personal information from children under 16. If we become aware of such collection, we will delete the information immediately and terminate the account.</p>

            <h2>12. Changes to This Privacy Policy</h2>

            <p>We may update this Privacy Policy periodically to reflect changes in our practices or legal requirements. We will:</p>
            <ul>
                <li><strong>Notify You:</strong> Send email notifications for material changes</li>
                <li><strong>Post Updates:</strong> Display the updated policy on our platform</li>
                <li><strong>Provide Notice:</strong> Give 30 days advance notice for significant changes</li>
                <li><strong>Obtain Consent:</strong> Request consent for changes that affect how we use your data</li>
            </ul>

            <p>Your continued use of our services after policy updates constitutes acceptance of the changes.</p>

            <div class="contact-box">
                <h3>13. Contact Information</h3>
                <p>For questions about this Privacy Policy or our data practices, please contact us:</p>
                
                <p><strong>Privacy Officer:</strong><br>
                Email: privacy@yourcompany.com<br>
                Phone: +1 (555) 123-4567</p>

                <p><strong>Data Protection Officer:</strong><br>
                Email: dpo@yourcompany.com</p>

                <p><strong>Mailing Address:</strong><br>
                [Your Company Name]<br>
                [Street Address]<br>
                [City, State, ZIP Code]<br>
                [Country]</p>

                <p><strong>EU Representative:</strong> (If applicable)<br>
                [EU Representative Details]</p>

                <p><strong>Response Time:</strong> We will respond to privacy inquiries within 30 days.</p>
            </div>

            <div class="highlight-box">
                <strong>Regulatory Compliance:</strong> This Privacy Policy is designed to comply with GDPR (EU), CCPA (California), PIPEDA (Canada), and other applicable privacy laws. We are committed to maintaining the highest standards of data protection and privacy.
            </div>
        </div>

        <div class="footer">
            <p>© ${new Date().getFullYear()} WhatsApp Business CRM Platform. All rights reserved.</p>
            <p>This Privacy Policy is effective as of ${new Date().toLocaleDateString()} and applies to all users of our platform.</p>
        </div>
    </div>
</body>
</html>
`;
