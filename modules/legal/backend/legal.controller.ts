/**
 * Legal Pages Controller
 * Serves privacy policy, terms of service, and other legal documents
 * CRITICAL FOR META VERIFICATION
 */

import { Request, Response } from 'express';
import { PRIVACY_POLICY_HTML } from './privacy-policy-production';

export class LegalController {
  
  /**
   * Privacy Policy
   * GET /legal/privacy-policy
   */
  static async privacyPolicy(req: Request, res: Response) {
    res.setHeader('Content-Type', 'text/html');
    res.send(PRIVACY_POLICY_HTML);
  }

  /**
   * Terms of Service
   * GET /legal/terms-of-service
   */
  static async termsOfService(req: Request, res: Response) {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Terms of Service - WhatsApp Business Platform</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; color: #333; }
        h1 { color: #1a73e8; border-bottom: 2px solid #1a73e8; padding-bottom: 10px; }
        h2 { color: #1a73e8; margin-top: 30px; }
        .last-updated { background: #f8f9fa; padding: 10px; border-radius: 5px; margin-bottom: 20px; }
        .important { background: #fff3cd; padding: 15px; border-radius: 5px; border-left: 4px solid #ffc107; margin: 20px 0; }
        .contact-info { background: #e8f5e8; padding: 15px; border-radius: 5px; margin-top: 20px; }
    </style>
</head>
<body>
    <h1>Terms of Service</h1>
    
    <div class="last-updated">
        <strong>Last Updated:</strong> ${new Date().toLocaleDateString()}
    </div>

    <div class="important">
        <strong>Important:</strong> By using our WhatsApp Business Platform, you agree to comply with Meta's WhatsApp Business Platform policies and all applicable laws and regulations.
    </div>

    <h2>1. Acceptance of Terms</h2>
    <p>By accessing or using our WhatsApp Business Platform services ("Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you may not use our Service.</p>

    <h2>2. Description of Service</h2>
    <p>Our platform provides WhatsApp Business API integration services, including:</p>
    <ul>
        <li>WhatsApp message sending and receiving</li>
        <li>Contact and conversation management</li>
        <li>Template message management</li>
        <li>Analytics and reporting</li>
        <li>Compliance and audit tools</li>
    </ul>

    <h2>3. User Accounts and Responsibilities</h2>
    
    <h3>3.1 Account Registration</h3>
    <ul>
        <li>You must provide accurate and complete information</li>
        <li>You are responsible for maintaining account security</li>
        <li>You must notify us immediately of unauthorized access</li>
        <li>One account per business entity</li>
    </ul>

    <h3>3.2 User Responsibilities</h3>
    <ul>
        <li><strong>Compliance:</strong> Follow all Meta WhatsApp Business policies</li>
        <li><strong>Opt-in:</strong> Obtain explicit consent before messaging users</li>
        <li><strong>Content:</strong> Ensure all content is legal and appropriate</li>
        <li><strong>Security:</strong> Protect your API credentials and access tokens</li>
        <li><strong>Accuracy:</strong> Provide accurate business and contact information</li>
    </ul>

    <h2>4. WhatsApp Business API Compliance</h2>
    
    <div class="important">
        <strong>Critical:</strong> Violation of WhatsApp policies may result in immediate account suspension and loss of WhatsApp API access.
    </div>

    <h3>4.1 Messaging Requirements</h3>
    <ul>
        <li><strong>Explicit Opt-in:</strong> Users must explicitly consent to receive messages</li>
        <li><strong>No Spam:</strong> Prohibited from sending unsolicited messages</li>
        <li><strong>Content Restrictions:</strong> No illegal, harmful, or inappropriate content</li>
        <li><strong>Rate Limits:</strong> Respect messaging rate limits and quotas</li>
        <li><strong>Opt-out:</strong> Provide clear unsubscribe mechanisms</li>
    </ul>

    <h3>4.2 Prohibited Activities</h3>
    <ul>
        <li>Sending spam or unsolicited messages</li>
        <li>Sharing or selling user data without consent</li>
        <li>Using the service for illegal activities</li>
        <li>Impersonating other individuals or businesses</li>
        <li>Circumventing platform security measures</li>
        <li>Automated message generation without proper controls</li>
    </ul>

    <h2>5. Service Availability and Limitations</h2>
    
    <h3>5.1 Service Level</h3>
    <ul>
        <li>We strive for 99.9% uptime but do not guarantee uninterrupted service</li>
        <li>Scheduled maintenance may temporarily affect service availability</li>
        <li>WhatsApp API limitations may impact service functionality</li>
    </ul>

    <h3>5.2 Usage Limits</h3>
    <ul>
        <li>Message quotas based on your subscription plan</li>
        <li>Rate limiting to prevent abuse</li>
        <li>Storage limits for messages and media</li>
        <li>API call limits per time period</li>
    </ul>

    <h2>6. Payment and Billing</h2>
    
    <h3>6.1 Subscription Plans</h3>
    <ul>
        <li>Various plans available with different features and limits</li>
        <li>Billing occurs monthly or annually as selected</li>
        <li>Prices subject to change with 30 days notice</li>
    </ul>

    <h3>6.2 Payment Terms</h3>
    <ul>
        <li>Payment due in advance for subscription periods</li>
        <li>Automatic renewal unless cancelled</li>
        <li>No refunds for partial months or unused services</li>
        <li>Suspension of service for non-payment</li>
    </ul>

    <h2>7. Intellectual Property</h2>
    
    <h3>7.1 Our Rights</h3>
    <ul>
        <li>We retain all rights to our platform, software, and documentation</li>
        <li>Our trademarks and logos remain our property</li>
        <li>You receive a limited license to use our services</li>
    </ul>

    <h3>7.2 Your Content</h3>
    <ul>
        <li>You retain ownership of your content and data</li>
        <li>You grant us license to process your content to provide services</li>
        <li>You are responsible for ensuring you have rights to all content</li>
    </ul>

    <h2>8. Privacy and Data Protection</h2>
    <p>Your privacy is important to us. Our data practices are governed by our Privacy Policy, which is incorporated into these Terms by reference. Key points:</p>
    <ul>
        <li>We collect and process data as described in our Privacy Policy</li>
        <li>We implement appropriate security measures</li>
        <li>We comply with applicable data protection laws</li>
        <li>You control your data and can request deletion</li>
    </ul>

    <h2>9. Termination</h2>
    
    <h3>9.1 Termination by You</h3>
    <ul>
        <li>You may terminate your account at any time</li>
        <li>Cancellation takes effect at the end of the current billing period</li>
        <li>You remain responsible for all charges incurred</li>
    </ul>

    <h3>9.2 Termination by Us</h3>
    <p>We may terminate or suspend your account immediately if:</p>
    <ul>
        <li>You violate these Terms or WhatsApp policies</li>
        <li>Your account is used for illegal activities</li>
        <li>You fail to pay required fees</li>
        <li>We are required to do so by law</li>
    </ul>

    <h2>10. Disclaimers and Limitation of Liability</h2>
    
    <h3>10.1 Service Disclaimers</h3>
    <ul>
        <li>Service provided "as is" without warranties</li>
        <li>We do not guarantee message delivery</li>
        <li>WhatsApp API functionality depends on Meta's services</li>
        <li>We are not responsible for third-party service interruptions</li>
    </ul>

    <h3>10.2 Limitation of Liability</h3>
    <ul>
        <li>Our liability is limited to the amount you paid in the last 12 months</li>
        <li>We are not liable for indirect, incidental, or consequential damages</li>
        <li>You are responsible for backing up your data</li>
        <li>Some jurisdictions may not allow these limitations</li>
    </ul>

    <h2>11. Indemnification</h2>
    <p>You agree to indemnify and hold us harmless from claims arising from:</p>
    <ul>
        <li>Your use of our services</li>
        <li>Your violation of these Terms</li>
        <li>Your violation of WhatsApp policies</li>
        <li>Your content or data</li>
        <li>Your violation of third-party rights</li>
    </ul>

    <h2>12. Governing Law and Disputes</h2>
    <ul>
        <li>These Terms are governed by [Your Jurisdiction] law</li>
        <li>Disputes will be resolved through binding arbitration</li>
        <li>Class action lawsuits are waived</li>
        <li>Injunctive relief may be sought in court</li>
    </ul>

    <h2>13. Changes to Terms</h2>
    <p>We may modify these Terms at any time. We will:</p>
    <ul>
        <li>Provide 30 days notice of material changes</li>
        <li>Post updated Terms on our platform</li>
        <li>Send email notifications to active users</li>
        <li>Your continued use constitutes acceptance</li>
    </ul>

    <div class="contact-info">
        <h2>14. Contact Information</h2>
        <p>For questions about these Terms, contact us at:</p>
        <ul>
            <li><strong>Email:</strong> legal@yourcompany.com</li>
            <li><strong>Address:</strong> [Your Business Address]</li>
            <li><strong>Phone:</strong> [Your Contact Number]</li>
        </ul>
    </div>

    <p><em>These Terms are designed to comply with Meta WhatsApp Business Platform requirements and applicable laws.</em></p>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }

  /**
   * Acceptable Use Policy
   * GET /legal/acceptable-use-policy
   */
  static async acceptableUsePolicy(req: Request, res: Response) {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Acceptable Use Policy - WhatsApp Business Platform</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; color: #333; }
        h1 { color: #1a73e8; border-bottom: 2px solid #1a73e8; padding-bottom: 10px; }
        h2 { color: #1a73e8; margin-top: 30px; }
        .last-updated { background: #f8f9fa; padding: 10px; border-radius: 5px; margin-bottom: 20px; }
        .prohibited { background: #f8d7da; padding: 15px; border-radius: 5px; border-left: 4px solid #dc3545; margin: 20px 0; }
        .required { background: #d1ecf1; padding: 15px; border-radius: 5px; border-left: 4px solid #17a2b8; margin: 20px 0; }
    </style>
</head>
<body>
    <h1>Acceptable Use Policy</h1>
    
    <div class="last-updated">
        <strong>Last Updated:</strong> ${new Date().toLocaleDateString()}
    </div>

    <h2>1. Purpose</h2>
    <p>This Acceptable Use Policy ("AUP") governs your use of our WhatsApp Business Platform services. This policy ensures compliance with Meta WhatsApp Business Platform policies and protects all users of our service.</p>

    <div class="required">
        <strong>Compliance Requirement:</strong> All users must strictly adhere to Meta's WhatsApp Business Platform policies. Violations may result in immediate account suspension and loss of WhatsApp API access.
    </div>

    <h2>2. Permitted Uses</h2>
    <p>You may use our platform for:</p>
    <ul>
        <li><strong>Business Communication:</strong> Legitimate business messaging with proper consent</li>
        <li><strong>Customer Support:</strong> Responding to customer inquiries and providing support</li>
        <li><strong>Transactional Messages:</strong> Order confirmations, shipping updates, appointment reminders</li>
        <li><strong>Marketing (with consent):</strong> Promotional messages to users who have explicitly opted in</li>
        <li><strong>Notifications:</strong> Service updates and account-related notifications</li>
    </ul>

    <h2>3. Prohibited Activities</h2>

    <div class="prohibited">
        <strong>Strictly Prohibited:</strong> The following activities will result in immediate account termination.
    </div>

    <h3>3.1 Spam and Unsolicited Messaging</h3>
    <ul>
        <li>Sending messages without explicit user consent</li>
        <li>Bulk messaging to purchased or scraped phone number lists</li>
        <li>Continuing to message users after they opt out</li>
        <li>Using automated systems to generate unsolicited messages</li>
        <li>Chain messages or pyramid schemes</li>
    </ul>

    <h3>3.2 Illegal Content and Activities</h3>
    <ul>
        <li>Illegal drugs, weapons, or controlled substances</li>
        <li>Fraudulent schemes or scams</li>
        <li>Money laundering or financial crimes</li>
        <li>Terrorism or violence promotion</li>
        <li>Human trafficking or exploitation</li>
        <li>Copyright or trademark infringement</li>
    </ul>

    <h3>3.3 Harmful or Inappropriate Content</h3>
    <ul>
        <li>Adult content or pornography</li>
        <li>Hate speech or discrimination</li>
        <li>Harassment, bullying, or threats</li>
        <li>Graphic violence or disturbing content</li>
        <li>Self-harm or suicide promotion</li>
        <li>Misinformation or fake news</li>
    </ul>

    <h3>3.4 Platform Abuse</h3>
    <ul>
        <li>Attempting to circumvent rate limits or security measures</li>
        <li>Creating multiple accounts to evade restrictions</li>
        <li>Sharing account credentials with unauthorized parties</li>
        <li>Reverse engineering or attempting to access source code</li>
        <li>Interfering with service operation or other users</li>
    </ul>

    <h3>3.5 Data Misuse</h3>
    <ul>
        <li>Collecting user data without consent</li>
        <li>Selling or sharing user contact information</li>
        <li>Using data for purposes other than stated</li>
        <li>Failing to secure user data appropriately</li>
        <li>Retaining data longer than necessary</li>
    </ul>

    <h2>4. WhatsApp-Specific Requirements</h2>

    <h3>4.1 Opt-in Requirements</h3>
    <div class="required">
        <strong>Mandatory:</strong> All messaging requires explicit, documented user consent.
    </div>
    <ul>
        <li>Users must actively opt in to receive messages</li>
        <li>Consent must be specific to your business</li>
        <li>Pre-checked boxes or implied consent are not acceptable</li>
        <li>Maintain records of all opt-in consents</li>
        <li>Provide clear information about message types and frequency</li>
    </ul>

    <h3>4.2 Opt-out Requirements</h3>
    <ul>
        <li>Provide clear unsubscribe instructions in every message</li>
        <li>Honor opt-out requests immediately</li>
        <li>Support standard opt-out keywords (STOP, UNSUBSCRIBE)</li>
        <li>Do not require users to log in to unsubscribe</li>
        <li>Confirm successful unsubscription</li>
    </ul>

    <h3>4.3 Message Content Standards</h3>
    <ul>
        <li>Messages must be relevant and valuable to recipients</li>
        <li>Avoid excessive promotional language</li>
        <li>Include clear sender identification</li>
        <li>Respect cultural and regional sensitivities</li>
        <li>Use appropriate language and tone</li>
    </ul>

    <h2>5. Rate Limits and Usage Guidelines</h2>

    <h3>5.1 Messaging Limits</h3>
    <ul>
        <li>Respect WhatsApp API rate limits</li>
        <li>Maximum 10 messages per hour per phone number</li>
        <li>No more than 100 messages per day per phone number</li>
        <li>Avoid burst messaging patterns</li>
        <li>Allow reasonable response time for users</li>
    </ul>

    <h3>5.2 Quality Standards</h3>
    <ul>
        <li>Maintain high message delivery rates</li>
        <li>Monitor and minimize user blocks and reports</li>
        <li>Respond promptly to user inquiries</li>
        <li>Keep opt-out rates below 5%</li>
        <li>Regularly review and improve message content</li>
    </ul>

    <h2>6. Compliance Monitoring</h2>

    <h3>6.1 Automated Monitoring</h3>
    <p>Our platform automatically monitors for:</p>
    <ul>
        <li>Spam patterns and suspicious activity</li>
        <li>High opt-out or block rates</li>
        <li>Prohibited content keywords</li>
        <li>Rate limit violations</li>
        <li>Unusual usage patterns</li>
    </ul>

    <h3>6.2 Manual Review</h3>
    <p>We may manually review accounts that:</p>
    <ul>
        <li>Receive user complaints</li>
        <li>Show unusual activity patterns</li>
        <li>Are flagged by automated systems</li>
        <li>Are reported by other users</li>
        <li>Request higher usage limits</li>
    </ul>

    <h2>7. Enforcement and Penalties</h2>

    <h3>7.1 Warning System</h3>
    <ul>
        <li><strong>First Violation:</strong> Written warning and guidance</li>
        <li><strong>Second Violation:</strong> Temporary account restriction</li>
        <li><strong>Third Violation:</strong> Account suspension pending review</li>
        <li><strong>Severe Violations:</strong> Immediate account termination</li>
    </ul>

    <h3>7.2 Immediate Termination</h3>
    <p>The following violations result in immediate account termination:</p>
    <ul>
        <li>Illegal activities</li>
        <li>Spam or mass unsolicited messaging</li>
        <li>Harmful or dangerous content</li>
        <li>Repeated policy violations</li>
        <li>Attempting to circumvent restrictions</li>
    </ul>

    <h2>8. Appeals Process</h2>
    <p>If your account is restricted or terminated:</p>
    <ul>
        <li>You may appeal the decision within 30 days</li>
        <li>Provide evidence of compliance or corrective measures</li>
        <li>Appeals are reviewed within 5-10 business days</li>
        <li>Decisions are final after appeal review</li>
        <li>Repeated violations may not be eligible for appeal</li>
    </ul>

    <h2>9. Reporting Violations</h2>
    <p>To report violations of this policy:</p>
    <ul>
        <li><strong>Email:</strong> abuse@yourcompany.com</li>
        <li><strong>Include:</strong> Account details, evidence, and description</li>
        <li><strong>Response Time:</strong> 24-48 hours for initial review</li>
        <li><strong>Confidentiality:</strong> Reports are handled confidentially</li>
    </ul>

    <h2>10. Updates to This Policy</h2>
    <p>This policy may be updated to reflect:</p>
    <ul>
        <li>Changes in WhatsApp Business Platform policies</li>
        <li>Legal or regulatory requirements</li>
        <li>Platform improvements and new features</li>
        <li>User feedback and industry best practices</li>
    </ul>

    <p><strong>Notice:</strong> We will provide 30 days notice of material changes to this policy.</p>

    <p><em>This Acceptable Use Policy is designed to ensure compliance with Meta WhatsApp Business Platform policies and maintain a safe, legal environment for all users.</em></p>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }

  /**
   * Data Processing Agreement (DPA)
   * GET /legal/data-processing-agreement
   */
  static async dataProcessingAgreement(req: Request, res: Response) {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Data Processing Agreement - WhatsApp Business Platform</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; color: #333; }
        h1 { color: #1a73e8; border-bottom: 2px solid #1a73e8; padding-bottom: 10px; }
        h2 { color: #1a73e8; margin-top: 30px; }
        .last-updated { background: #f8f9fa; padding: 10px; border-radius: 5px; margin-bottom: 20px; }
        .definition { background: #e8f5e8; padding: 10px; border-radius: 5px; margin: 10px 0; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background-color: #f8f9fa; }
    </style>
</head>
<body>
    <h1>Data Processing Agreement (DPA)</h1>
    
    <div class="last-updated">
        <strong>Effective Date:</strong> ${new Date().toLocaleDateString()}
    </div>

    <h2>1. Introduction and Scope</h2>
    <p>This Data Processing Agreement ("DPA") forms part of the Terms of Service between you ("Controller") and us ("Processor") regarding the processing of personal data in connection with our WhatsApp Business Platform services.</p>

    <p>This DPA applies to the processing of personal data by us on your behalf in the course of providing our services, in accordance with applicable data protection laws including the General Data Protection Regulation (GDPR).</p>

    <h2>2. Definitions</h2>
    <div class="definition">
        <strong>Personal Data:</strong> Any information relating to an identified or identifiable natural person, including WhatsApp phone numbers, names, message content, and usage data.
    </div>
    <div class="definition">
        <strong>Processing:</strong> Any operation performed on personal data, including collection, storage, transmission, analysis, and deletion.
    </div>
    <div class="definition">
        <strong>Controller:</strong> You, the customer, who determines the purposes and means of processing personal data.
    </div>
    <div class="definition">
        <strong>Processor:</strong> Us, who processes personal data on behalf of the Controller.
    </div>

    <h2>3. Processing Details</h2>
    
    <table>
        <tr>
            <th>Aspect</th>
            <th>Details</th>
        </tr>
        <tr>
            <td><strong>Subject Matter</strong></td>
            <td>WhatsApp Business messaging services and related functionality</td>
        </tr>
        <tr>
            <td><strong>Duration</strong></td>
            <td>For the duration of the service agreement</td>
        </tr>
        <tr>
            <td><strong>Purpose</strong></td>
            <td>To provide WhatsApp messaging, contact management, and analytics services</td>
        </tr>
        <tr>
            <td><strong>Categories of Data</strong></td>
            <td>Contact information, message content, usage data, device information</td>
        </tr>
        <tr>
            <td><strong>Data Subjects</strong></td>
            <td>Your customers, contacts, and end users who interact via WhatsApp</td>
        </tr>
    </table>

    <h2>4. Controller and Processor Obligations</h2>

    <h3>4.1 Controller Obligations (Your Responsibilities)</h3>
    <ul>
        <li><strong>Legal Basis:</strong> Ensure you have a legal basis for processing personal data</li>
        <li><strong>Consent:</strong> Obtain necessary consents from data subjects</li>
        <li><strong>Instructions:</strong> Provide clear, lawful instructions for data processing</li>
        <li><strong>Data Subject Rights:</strong> Handle data subject requests and inform us as needed</li>
        <li><strong>Accuracy:</strong> Ensure personal data is accurate and up-to-date</li>
        <li><strong>Compliance:</strong> Comply with applicable data protection laws</li>
    </ul>

    <h3>4.2 Processor Obligations (Our Responsibilities)</h3>
    <ul>
        <li><strong>Instructions:</strong> Process personal data only according to your documented instructions</li>
        <li><strong>Confidentiality:</strong> Ensure authorized personnel are bound by confidentiality</li>
        <li><strong>Security:</strong> Implement appropriate technical and organizational measures</li>
        <li><strong>Sub-processors:</strong> Only engage sub-processors with your consent</li>
        <li><strong>Data Subject Rights:</strong> Assist with data subject requests</li>
        <li><strong>Breach Notification:</strong> Notify you of personal data breaches without delay</li>
        <li><strong>Deletion:</strong> Delete or return personal data at the end of services</li>
        <li><strong>Audits:</strong> Make available information necessary for demonstrating compliance</li>
    </ul>

    <h2>5. Security Measures</h2>
    <p>We implement the following technical and organizational measures:</p>

    <h3>5.1 Technical Measures</h3>
    <ul>
        <li><strong>Encryption:</strong> Data encrypted in transit and at rest using AES-256</li>
        <li><strong>Access Controls:</strong> Role-based access with multi-factor authentication</li>
        <li><strong>Network Security:</strong> Firewalls, intrusion detection, and secure protocols</li>
        <li><strong>Data Backup:</strong> Regular backups with encryption and secure storage</li>
        <li><strong>Monitoring:</strong> Continuous security monitoring and logging</li>
    </ul>

    <h3>5.2 Organizational Measures</h3>
    <ul>
        <li><strong>Staff Training:</strong> Regular data protection and security training</li>
        <li><strong>Access Management:</strong> Principle of least privilege and regular access reviews</li>
        <li><strong>Incident Response:</strong> Documented procedures for security incidents</li>
        <li><strong>Vendor Management:</strong> Due diligence on sub-processors</li>
        <li><strong>Compliance:</strong> Regular compliance audits and assessments</li>
    </ul>

    <h2>6. Sub-processors</h2>
    <p>We may engage the following categories of sub-processors:</p>

    <table>
        <tr>
            <th>Category</th>
            <th>Purpose</th>
            <th>Location</th>
        </tr>
        <tr>
            <td>Cloud Infrastructure</td>
            <td>Data hosting and storage</td>
            <td>EU/US (with adequacy decisions or SCCs)</td>
        </tr>
        <tr>
            <td>WhatsApp Business API</td>
            <td>Message delivery</td>
            <td>Global (Meta/Facebook)</td>
        </tr>
        <tr>
            <td>Analytics Services</td>
            <td>Usage analytics and monitoring</td>
            <td>EU/US (with adequacy decisions or SCCs)</td>
        </tr>
        <tr>
            <td>Support Services</td>
            <td>Customer support and maintenance</td>
            <td>EU/US</td>
        </tr>
    </table>

    <p><strong>Sub-processor Changes:</strong> We will inform you of any intended changes to sub-processors, giving you the opportunity to object.</p>

    <h2>7. International Data Transfers</h2>
    <p>Personal data may be transferred to countries outside the European Economic Area. We ensure adequate protection through:</p>
    <ul>
        <li><strong>Adequacy Decisions:</strong> Transfers to countries with adequacy decisions</li>
        <li><strong>Standard Contractual Clauses:</strong> EU-approved SCCs for other transfers</li>
        <li><strong>Binding Corporate Rules:</strong> Where applicable for intra-group transfers</li>
        <li><strong>Certification Schemes:</strong> Recognized certification mechanisms</li>
    </ul>

    <h2>8. Data Subject Rights</h2>
    <p>We will assist you in fulfilling data subject rights requests:</p>

    <h3>8.1 Types of Requests</h3>
    <ul>
        <li><strong>Access:</strong> Provide copies of personal data</li>
        <li><strong>Rectification:</strong> Correct inaccurate personal data</li>
        <li><strong>Erasure:</strong> Delete personal data ("right to be forgotten")</li>
        <li><strong>Restriction:</strong> Limit processing of personal data</li>
        <li><strong>Portability:</strong> Provide data in machine-readable format</li>
        <li><strong>Objection:</strong> Stop processing for specific purposes</li>
    </ul>

    <h3>8.2 Response Process</h3>
    <ul>
        <li>Forward requests to you within 24 hours</li>
        <li>Provide necessary technical assistance</li>
        <li>Implement your instructions regarding the request</li>
        <li>Maintain records of requests and responses</li>
    </ul>

    <h2>9. Personal Data Breaches</h2>
    <p>In case of a personal data breach:</p>

    <h3>9.1 Notification Timeline</h3>
    <ul>
        <li><strong>Immediate:</strong> Internal incident response team activated</li>
        <li><strong>Within 24 hours:</strong> Notification to you with initial assessment</li>
        <li><strong>Within 72 hours:</strong> Detailed breach report provided</li>
        <li><strong>Ongoing:</strong> Regular updates until resolution</li>
    </ul>

    <h3>9.2 Breach Information</h3>
    <p>Our notification will include:</p>
    <ul>
        <li>Nature and categories of personal data affected</li>
        <li>Approximate number of data subjects and records</li>
        <li>Likely consequences of the breach</li>
        <li>Measures taken or proposed to address the breach</li>
        <li>Contact information for further details</li>
    </ul>

    <h2>10. Data Retention and Deletion</h2>

    <h3>10.1 Retention Periods</h3>
    <ul>
        <li><strong>Message Data:</strong> 90 days unless longer retention requested</li>
        <li><strong>Contact Data:</strong> Duration of service agreement</li>
        <li><strong>Compliance Logs:</strong> 2 years for audit purposes</li>
        <li><strong>Opt-in Records:</strong> Indefinitely for compliance verification</li>
    </ul>

    <h3>10.2 Data Deletion</h3>
    <p>Upon termination of services or your request:</p>
    <ul>
        <li>Secure deletion of all personal data within 30 days</li>
        <li>Certification of deletion provided upon request</li>
        <li>Exception for data required by law or legitimate interests</li>
        <li>Backup data deleted according to retention schedules</li>
    </ul>

    <h2>11. Audits and Compliance</h2>

    <h3>11.1 Audit Rights</h3>
    <ul>
        <li>You may audit our compliance with this DPA</li>
        <li>Audits conducted at reasonable intervals</li>
        <li>We will cooperate and provide necessary information</li>
        <li>Third-party auditors acceptable with confidentiality agreements</li>
    </ul>

    <h3>11.2 Compliance Documentation</h3>
    <ul>
        <li>Security certifications and audit reports</li>
        <li>Data processing records and logs</li>
        <li>Staff training records</li>
        <li>Incident response documentation</li>
    </ul>

    <h2>12. Liability and Indemnification</h2>
    <ul>
        <li>Each party liable for damages caused by its breach of data protection laws</li>
        <li>Liability limited as set out in the main service agreement</li>
        <li>We will indemnify you for damages resulting from our non-compliance</li>
        <li>You will indemnify us for damages resulting from your unlawful instructions</li>
    </ul>

    <h2>13. Term and Termination</h2>
    <ul>
        <li>This DPA remains in effect for the duration of the service agreement</li>
        <li>Survives termination for obligations related to data deletion and compliance</li>
        <li>May be terminated by either party with 30 days written notice</li>
        <li>Immediate termination allowed for material breach</li>
    </ul>

    <h2>14. Contact Information</h2>
    <p>For DPA-related matters, contact:</p>
    <ul>
        <li><strong>Data Protection Officer:</strong> dpo@yourcompany.com</li>
        <li><strong>Legal Department:</strong> legal@yourcompany.com</li>
        <li><strong>Security Team:</strong> security@yourcompany.com</li>
        <li><strong>Address:</strong> [Your Business Address]</li>
    </ul>

    <p><em>This DPA is designed to comply with GDPR, CCPA, and other applicable data protection regulations.</em></p>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }
}
