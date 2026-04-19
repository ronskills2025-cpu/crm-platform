/**
 * COMPLETE ONBOARDING GUIDE
 * WhatsApp Business API Integration
 * Professional SaaS Onboarding Flow (WATI-style)
 */

export const ONBOARDING_GUIDE_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WhatsApp Business API Setup Guide</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container { 
            max-width: 1000px; 
            margin: 0 auto; 
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #25D366 0%, #128C7E 100%);
            color: white;
            padding: 40px;
            text-align: center;
        }
        .header h1 { 
            font-size: 2.5rem; 
            font-weight: 700;
            margin-bottom: 15px;
        }
        .header p { 
            font-size: 1.2rem; 
            opacity: 0.9;
            max-width: 600px;
            margin: 0 auto;
        }
        .progress-bar {
            background: white;
            padding: 20px 40px;
            border-bottom: 1px solid #e9ecef;
        }
        .progress-steps {
            display: flex;
            justify-content: space-between;
            align-items: center;
            max-width: 800px;
            margin: 0 auto;
        }
        .step {
            display: flex;
            flex-direction: column;
            align-items: center;
            flex: 1;
            position: relative;
        }
        .step:not(:last-child)::after {
            content: '';
            position: absolute;
            top: 20px;
            right: -50%;
            width: 100%;
            height: 2px;
            background: #e9ecef;
            z-index: 1;
        }
        .step.completed::after {
            background: #25D366;
        }
        .step-number {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: #e9ecef;
            color: #6c757d;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 600;
            margin-bottom: 8px;
            position: relative;
            z-index: 2;
        }
        .step.completed .step-number {
            background: #25D366;
            color: white;
        }
        .step.active .step-number {
            background: #007bff;
            color: white;
        }
        .step-label {
            font-size: 0.9rem;
            color: #6c757d;
            text-align: center;
        }
        .step.completed .step-label,
        .step.active .step-label {
            color: #2c3e50;
            font-weight: 500;
        }
        .content { 
            padding: 40px;
        }
        .step-content {
            display: none;
        }
        .step-content.active {
            display: block;
        }
        h2 { 
            color: #2c3e50; 
            font-size: 2rem;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
        }
        h2 .icon {
            width: 40px;
            height: 40px;
            border-radius: 8px;
            background: #e3f2fd;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 15px;
            font-size: 1.2rem;
        }
        h3 { 
            color: #34495e; 
            font-size: 1.4rem;
            margin: 25px 0 15px 0;
        }
        p { 
            margin-bottom: 15px; 
            font-size: 1.1rem;
            line-height: 1.6;
            color: #5a6c7d;
        }
        .instruction-box { 
            background: #f8f9fa; 
            padding: 25px; 
            border-radius: 12px; 
            margin: 20px 0;
            border-left: 4px solid #007bff;
        }
        .warning-box { 
            background: #fff3cd; 
            padding: 20px; 
            border-radius: 8px; 
            margin: 20px 0;
            border-left: 4px solid #ffc107;
        }
        .success-box { 
            background: #d4edda; 
            padding: 20px; 
            border-radius: 8px; 
            margin: 20px 0;
            border-left: 4px solid #28a745;
        }
        .button {
            display: inline-block;
            padding: 12px 24px;
            background: #007bff;
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 500;
            transition: all 0.3s ease;
            border: none;
            cursor: pointer;
            font-size: 1rem;
        }
        .button:hover {
            background: #0056b3;
            transform: translateY(-2px);
        }
        .button.success {
            background: #28a745;
        }
        .button.success:hover {
            background: #1e7e34;
        }
        .button.whatsapp {
            background: #25D366;
        }
        .button.whatsapp:hover {
            background: #128C7E;
        }
        .screenshot {
            width: 100%;
            max-width: 600px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            margin: 20px 0;
        }
        .requirements {
            background: #e8f4fd;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
        }
        .requirements h4 {
            color: #1976d2;
            margin-bottom: 10px;
        }
        .requirements ul {
            margin-left: 20px;
        }
        .requirements li {
            margin-bottom: 5px;
        }
        .navigation {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e9ecef;
        }
        .nav-button {
            padding: 10px 20px;
            border: 1px solid #dee2e6;
            background: white;
            color: #6c757d;
            border-radius: 6px;
            text-decoration: none;
            font-weight: 500;
        }
        .nav-button:hover {
            background: #f8f9fa;
        }
        .nav-button.primary {
            background: #007bff;
            color: white;
            border-color: #007bff;
        }
        .nav-button.primary:hover {
            background: #0056b3;
        }
        .checklist {
            background: white;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
        }
        .checklist-item {
            display: flex;
            align-items: center;
            padding: 10px 0;
            border-bottom: 1px solid #f8f9fa;
        }
        .checklist-item:last-child {
            border-bottom: none;
        }
        .checkbox {
            width: 20px;
            height: 20px;
            border: 2px solid #dee2e6;
            border-radius: 4px;
            margin-right: 15px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .checkbox.checked {
            background: #28a745;
            border-color: #28a745;
            color: white;
        }
        @media (max-width: 768px) {
            .container { margin: 10px; }
            .header, .content { padding: 20px; }
            .header h1 { font-size: 2rem; }
            .progress-steps { flex-direction: column; gap: 20px; }
            .step::after { display: none; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 WhatsApp Business API Setup</h1>
            <p>Connect your WhatsApp Business Account in just a few simple steps. Get started with professional WhatsApp messaging for your business.</p>
        </div>
        
        <div class="progress-bar">
            <div class="progress-steps">
                <div class="step active">
                    <div class="step-number">1</div>
                    <div class="step-label">Account Setup</div>
                </div>
                <div class="step">
                    <div class="step-number">2</div>
                    <div class="step-label">Facebook Connect</div>
                </div>
                <div class="step">
                    <div class="step-number">3</div>
                    <div class="step-label">Business Manager</div>
                </div>
                <div class="step">
                    <div class="step-number">4</div>
                    <div class="step-label">WhatsApp Setup</div>
                </div>
                <div class="step">
                    <div class="step-number">5</div>
                    <div class="step-label">Phone Verification</div>
                </div>
                <div class="step">
                    <div class="step-number">6</div>
                    <div class="step-label">Permissions</div>
                </div>
                <div class="step">
                    <div class="step-number">7</div>
                    <div class="step-label">Complete</div>
                </div>
            </div>
        </div>

        <div class="content">
            <!-- STEP 1: ACCOUNT SETUP -->
            <div class="step-content active" id="step-1">
                <h2><span class="icon">👤</span>Step 1: Account Setup</h2>
                
                <p>Welcome! Let's get your WhatsApp Business messaging set up. First, make sure you have access to your business accounts.</p>

                <div class="requirements">
                    <h4>📋 What You'll Need:</h4>
                    <ul>
                        <li><strong>Facebook Business Manager Account</strong> (or admin access to create one)</li>
                        <li><strong>Business Phone Number</strong> (not currently used on WhatsApp)</li>
                        <li><strong>Business Verification Documents</strong> (business license, website, etc.)</li>
                        <li><strong>Admin Access</strong> to your Facebook Business Manager</li>
                    </ul>
                </div>

                <div class="instruction-box">
                    <h3>🎯 Before We Start</h3>
                    <p><strong>Important:</strong> Make sure you're logged into the correct Facebook account that has admin access to your Business Manager. If you don't have a Business Manager account, we'll help you create one in the next step.</p>
                </div>

                <div class="checklist">
                    <div class="checklist-item">
                        <div class="checkbox" onclick="toggleCheck(this)"></div>
                        <span>I have admin access to a Facebook Business Manager account</span>
                    </div>
                    <div class="checklist-item">
                        <div class="checkbox" onclick="toggleCheck(this)"></div>
                        <span>I have a business phone number ready for WhatsApp</span>
                    </div>
                    <div class="checklist-item">
                        <div class="checkbox" onclick="toggleCheck(this)"></div>
                        <span>I have business verification documents available</span>
                    </div>
                    <div class="checklist-item">
                        <div class="checkbox" onclick="toggleCheck(this)"></div>
                        <span>I'm logged into the correct Facebook account</span>
                    </div>
                </div>

                <div class="navigation">
                    <span></span>
                    <a href="#" class="nav-button primary" onclick="nextStep()">Continue to Facebook Connect →</a>
                </div>
            </div>

            <!-- STEP 2: FACEBOOK CONNECT -->
            <div class="step-content" id="step-2">
                <h2><span class="icon">📘</span>Step 2: Connect Facebook Account</h2>
                
                <p>Now we'll connect your Facebook account to access your Business Manager. This is required for WhatsApp Business API integration.</p>

                <div class="instruction-box">
                    <h3>🔗 Facebook OAuth Connection</h3>
                    <p>When you click "Connect Facebook" below, you'll be redirected to Facebook to authorize our application. This is completely secure and follows Facebook's official OAuth process.</p>
                    
                    <p><strong>What happens next:</strong></p>
                    <ol>
                        <li>You'll be redirected to Facebook</li>
                        <li>Log in with your business Facebook account</li>
                        <li>Review and approve the requested permissions</li>
                        <li>You'll be redirected back to our platform</li>
                    </ol>
                </div>

                <div class="warning-box">
                    <strong>⚠️ Important:</strong> Make sure you're using the Facebook account that has admin access to your Business Manager. If you use a personal account without business access, you'll need to start over.
                </div>

                <div style="text-align: center; margin: 30px 0;">
                    <a href="#" class="button" style="background: #1877f2; font-size: 1.1rem; padding: 15px 30px;">
                        📘 Connect Facebook Account
                    </a>
                </div>

                <div class="success-box" style="display: none;" id="facebook-connected">
                    <h4>✅ Facebook Connected Successfully!</h4>
                    <p>Great! We've successfully connected your Facebook account. We can now access your Business Manager to set up WhatsApp.</p>
                </div>

                <div class="navigation">
                    <a href="#" class="nav-button" onclick="prevStep()">← Back</a>
                    <a href="#" class="nav-button primary" onclick="nextStep()">Continue to Business Manager →</a>
                </div>
            </div>

            <!-- STEP 3: BUSINESS MANAGER SELECTION -->
            <div class="step-content" id="step-3">
                <h2><span class="icon">🏢</span>Step 3: Business Manager Selection</h2>
                
                <p>Select your Facebook Business Manager account. If you don't have one, we'll help you create a new one.</p>

                <div class="instruction-box">
                    <h3>📊 Business Manager Options</h3>
                    <p>Choose from your existing Business Manager accounts or create a new one:</p>
                </div>

                <!-- Existing Business Manager -->
                <div style="border: 2px solid #e9ecef; border-radius: 8px; padding: 20px; margin: 20px 0;">
                    <h4>📈 Use Existing Business Manager</h4>
                    <p>Select from your current Business Manager accounts:</p>
                    
                    <div style="margin: 15px 0;">
                        <select style="width: 100%; padding: 10px; border: 1px solid #dee2e6; border-radius: 4px; font-size: 1rem;">
                            <option>Select Business Manager Account...</option>
                            <option>Acme Corp Business Manager</option>
                            <option>Marketing Agency BM</option>
                            <option>E-commerce Store BM</option>
                        </select>
                    </div>
                    
                    <button class="button">Select This Business Manager</button>
                </div>

                <!-- Create New Business Manager -->
                <div style="border: 2px solid #e9ecef; border-radius: 8px; padding: 20px; margin: 20px 0;">
                    <h4>🆕 Create New Business Manager</h4>
                    <p>Don't have a Business Manager? Create one now:</p>
                    
                    <div style="margin: 15px 0;">
                        <input type="text" placeholder="Business Name" style="width: 100%; padding: 10px; border: 1px solid #dee2e6; border-radius: 4px; margin-bottom: 10px;">
                        <input type="email" placeholder="Business Email" style="width: 100%; padding: 10px; border: 1px solid #dee2e6; border-radius: 4px;">
                    </div>
                    
                    <button class="button success">Create Business Manager</button>
                </div>

                <div class="warning-box">
                    <strong>💡 Tip:</strong> If you're setting up WhatsApp for a client, make sure you have admin access to their Business Manager, or create a new one that you can manage.
                </div>

                <div class="navigation">
                    <a href="#" class="nav-button" onclick="prevStep()">← Back</a>
                    <a href="#" class="nav-button primary" onclick="nextStep()">Continue to WhatsApp Setup →</a>
                </div>
            </div>

            <!-- STEP 4: WHATSAPP BUSINESS SETUP -->
            <div class="step-content" id="step-4">
                <h2><span class="icon">💬</span>Step 4: WhatsApp Business Account Setup</h2>
                
                <p>Now we'll create or select your WhatsApp Business Account (WABA) within your Business Manager.</p>

                <div class="instruction-box">
                    <h3>🔧 WhatsApp Business Account Configuration</h3>
                    <p>We'll help you set up your WhatsApp Business Account with the following options:</p>
                </div>

                <!-- Create New WABA -->
                <div style="border: 2px solid #25D366; border-radius: 8px; padding: 20px; margin: 20px 0; background: #f8fff8;">
                    <h4>🆕 Create New WhatsApp Business Account</h4>
                    <p>Recommended for most businesses:</p>
                    
                    <div style="margin: 15px 0;">
                        <input type="text" placeholder="WhatsApp Business Account Name" style="width: 100%; padding: 10px; border: 1px solid #dee2e6; border-radius: 4px; margin-bottom: 10px;">
                        <select style="width: 100%; padding: 10px; border: 1px solid #dee2e6; border-radius: 4px; margin-bottom: 10px;">
                            <option>Select Business Category...</option>
                            <option>E-commerce</option>
                            <option>Customer Service</option>
                            <option>Marketing</option>
                            <option>Healthcare</option>
                            <option>Education</option>
                            <option>Other</option>
                        </select>
                        <input type="url" placeholder="Business Website (optional)" style="width: 100%; padding: 10px; border: 1px solid #dee2e6; border-radius: 4px;">
                    </div>
                    
                    <button class="button whatsapp">Create WhatsApp Business Account</button>
                </div>

                <!-- Use Existing WABA -->
                <div style="border: 2px solid #e9ecef; border-radius: 8px; padding: 20px; margin: 20px 0;">
                    <h4>📱 Use Existing WhatsApp Business Account</h4>
                    <p>If you already have a WABA in this Business Manager:</p>
                    
                    <div style="margin: 15px 0;">
                        <select style="width: 100%; padding: 10px; border: 1px solid #dee2e6; border-radius: 4px;">
                            <option>Select Existing WABA...</option>
                            <option>Main Business WhatsApp</option>
                            <option>Customer Support WABA</option>
                        </select>
                    </div>
                    
                    <button class="button">Use This WABA</button>
                </div>

                <div class="success-box" style="display: none;" id="waba-created">
                    <h4>✅ WhatsApp Business Account Ready!</h4>
                    <p><strong>WABA ID:</strong> 1234567890123456</p>
                    <p>Your WhatsApp Business Account has been created successfully. Now let's add your phone number.</p>
                </div>

                <div class="navigation">
                    <a href="#" class="nav-button" onclick="prevStep()">← Back</a>
                    <a href="#" class="nav-button primary" onclick="nextStep()">Continue to Phone Verification →</a>
                </div>
            </div>

            <!-- STEP 5: PHONE VERIFICATION -->
            <div class="step-content" id="step-5">
                <h2><span class="icon">📞</span>Step 5: Phone Number Verification</h2>
                
                <p>Add and verify your business phone number for WhatsApp messaging.</p>

                <div class="warning-box">
                    <strong>⚠️ Important Requirements:</strong>
                    <ul>
                        <li>Phone number must NOT be currently registered on WhatsApp (personal or business)</li>
                        <li>Must be a valid business phone number</li>
                        <li>You must have access to receive SMS or voice calls on this number</li>
                        <li>Number cannot be a virtual/VOIP number (in most cases)</li>
                    </ul>
                </div>

                <div class="instruction-box">
                    <h3>📱 Add Your Business Phone Number</h3>
                    <p>Enter your business phone number that will be used for WhatsApp messaging:</p>
                    
                    <div style="margin: 20px 0;">
                        <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                            <select style="padding: 12px; border: 1px solid #dee2e6; border-radius: 4px; font-size: 1rem;">
                                <option>🇺🇸 +1</option>
                                <option>🇬🇧 +44</option>
                                <option>🇮🇳 +91</option>
                                <option>🇦🇺 +61</option>
                                <option>🇨🇦 +1</option>
                            </select>
                            <input type="tel" placeholder="Enter phone number" style="flex: 1; padding: 12px; border: 1px solid #dee2e6; border-radius: 4px; font-size: 1rem;">
                        </div>
                        
                        <button class="button whatsapp" style="width: 100%;">Add Phone Number</button>
                    </div>
                </div>

                <!-- Verification Process -->
                <div style="border: 2px solid #ffc107; border-radius: 8px; padding: 20px; margin: 20px 0; background: #fffbf0; display: none;" id="verification-process">
                    <h4>🔐 Verification in Progress</h4>
                    <p>We're sending a verification code to <strong>+1 (555) 123-4567</strong></p>
                    
                    <div style="margin: 20px 0;">
                        <p>Choose verification method:</p>
                        <div style="margin: 10px 0;">
                            <label style="display: block; margin: 10px 0;">
                                <input type="radio" name="verification" value="sms" checked> 📱 SMS (Recommended)
                            </label>
                            <label style="display: block; margin: 10px 0;">
                                <input type="radio" name="verification" value="voice"> 📞 Voice Call
                            </label>
                        </div>
                        
                        <button class="button">Send Verification Code</button>
                    </div>
                </div>

                <!-- Code Entry -->
                <div style="border: 2px solid #17a2b8; border-radius: 8px; padding: 20px; margin: 20px 0; background: #f0f9ff; display: none;" id="code-entry">
                    <h4>📨 Enter Verification Code</h4>
                    <p>Enter the 6-digit code sent to your phone:</p>
                    
                    <div style="margin: 20px 0;">
                        <input type="text" placeholder="000000" maxlength="6" style="width: 200px; padding: 15px; border: 2px solid #dee2e6; border-radius: 8px; font-size: 1.5rem; text-align: center; letter-spacing: 5px;">
                        <br><br>
                        <button class="button success">Verify Code</button>
                        <button class="button" style="background: #6c757d; margin-left: 10px;">Resend Code</button>
                    </div>
                </div>

                <div class="success-box" style="display: none;" id="phone-verified">
                    <h4>✅ Phone Number Verified Successfully!</h4>
                    <p><strong>WhatsApp Number:</strong> +1 (555) 123-4567</p>
                    <p><strong>Phone Number ID:</strong> 1234567890</p>
                    <p>Your business phone number is now ready for WhatsApp messaging!</p>
                </div>

                <div class="navigation">
                    <a href="#" class="nav-button" onclick="prevStep()">← Back</a>
                    <a href="#" class="nav-button primary" onclick="nextStep()">Continue to Permissions →</a>
                </div>
            </div>

            <!-- STEP 6: PERMISSIONS -->
            <div class="step-content" id="step-6">
                <h2><span class="icon">🔐</span>Step 6: Grant Required Permissions</h2>
                
                <p>Review and grant the necessary permissions for WhatsApp Business API integration.</p>

                <div class="instruction-box">
                    <h3>🛡️ Required Permissions</h3>
                    <p>Our platform needs these permissions to manage your WhatsApp Business messaging:</p>
                </div>

                <div class="checklist">
                    <div class="checklist-item">
                        <div class="checkbox checked">✓</div>
                        <div>
                            <strong>whatsapp_business_messaging</strong><br>
                            <small>Send and receive WhatsApp messages on your behalf</small>
                        </div>
                    </div>
                    <div class="checklist-item">
                        <div class="checkbox checked">✓</div>
                        <div>
                            <strong>whatsapp_business_management</strong><br>
                            <small>Manage your WhatsApp Business Account settings</small>
                        </div>
                    </div>
                    <div class="checklist-item">
                        <div class="checkbox checked">✓</div>
                        <div>
                            <strong>business_management</strong><br>
                            <small>Access your Business Manager account information</small>
                        </div>
                    </div>
                    <div class="checklist-item">
                        <div class="checkbox checked">✓</div>
                        <div>
                            <strong>pages_messaging</strong><br>
                            <small>Manage messaging for connected Facebook Pages</small>
                        </div>
                    </div>
                </div>

                <div class="warning-box">
                    <strong>🔒 Privacy & Security:</strong> We only use these permissions to provide WhatsApp messaging services. We never access your personal data or use your information for any other purpose. You can revoke these permissions at any time through your Facebook Business Manager.
                </div>

                <div style="text-align: center; margin: 30px 0;">
                    <button class="button success" style="font-size: 1.1rem; padding: 15px 30px;">
                        ✅ Grant Permissions & Continue
                    </button>
                </div>

                <div class="success-box" style="display: none;" id="permissions-granted">
                    <h4>✅ Permissions Granted Successfully!</h4>
                    <p>Perfect! We now have the necessary permissions to manage your WhatsApp Business messaging. Setting up your account...</p>
                </div>

                <div class="navigation">
                    <a href="#" class="nav-button" onclick="prevStep()">← Back</a>
                    <a href="#" class="nav-button primary" onclick="nextStep()">Complete Setup →</a>
                </div>
            </div>

            <!-- STEP 7: COMPLETE -->
            <div class="step-content" id="step-7">
                <h2><span class="icon">🎉</span>Setup Complete!</h2>
                
                <div class="success-box">
                    <h3>🚀 Your WhatsApp Business API is Ready!</h3>
                    <p>Congratulations! You've successfully connected your WhatsApp Business Account. Here's what we've set up for you:</p>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin: 30px 0;">
                    <div style="border: 1px solid #e9ecef; border-radius: 8px; padding: 20px;">
                        <h4>📱 WhatsApp Connection</h4>
                        <p><strong>Business Phone:</strong> +1 (555) 123-4567</p>
                        <p><strong>WABA ID:</strong> 1234567890123456</p>
                        <p><strong>Status:</strong> ✅ Active</p>
                    </div>
                    
                    <div style="border: 1px solid #e9ecef; border-radius: 8px; padding: 20px;">
                        <h4>🔗 API Integration</h4>
                        <p><strong>Webhook:</strong> ✅ Configured</p>
                        <p><strong>Permissions:</strong> ✅ Granted</p>
                        <p><strong>Status:</strong> ✅ Connected</p>
                    </div>
                </div>

                <div class="instruction-box">
                    <h3>🎯 What's Next?</h3>
                    <p>Your WhatsApp Business API is now ready to use! Here's what you can do:</p>
                    
                    <ol>
                        <li><strong>Send Your First Message:</strong> Test the connection with a message</li>
                        <li><strong>Set Up Templates:</strong> Create message templates for your business</li>
                        <li><strong>Configure Webhooks:</strong> Receive incoming messages automatically</li>
                        <li><strong>Invite Team Members:</strong> Add your team to manage conversations</li>
                    </ol>
                </div>

                <div style="text-align: center; margin: 30px 0;">
                    <a href="/dashboard" class="button success" style="font-size: 1.2rem; padding: 15px 30px; margin: 0 10px;">
                        🚀 Go to Dashboard
                    </a>
                    <a href="/test-message" class="button whatsapp" style="font-size: 1.2rem; padding: 15px 30px; margin: 0 10px;">
                        💬 Send Test Message
                    </a>
                </div>

                <div class="requirements">
                    <h4>📚 Helpful Resources</h4>
                    <ul>
                        <li><a href="/docs/messaging-guide">WhatsApp Messaging Best Practices</a></li>
                        <li><a href="/docs/templates">Creating Message Templates</a></li>
                        <li><a href="/docs/compliance">Meta Compliance Guidelines</a></li>
                        <li><a href="/support">Contact Support</a></li>
                    </ul>
                </div>

                <div class="navigation">
                    <a href="#" class="nav-button" onclick="prevStep()">← Back</a>
                    <span></span>
                </div>
            </div>
        </div>
    </div>

    <script>
        let currentStep = 1;
        const totalSteps = 7;

        function updateProgress() {
            // Update progress bar
            document.querySelectorAll('.step').forEach((step, index) => {
                const stepNum = index + 1;
                step.classList.remove('active', 'completed');
                
                if (stepNum < currentStep) {
                    step.classList.add('completed');
                } else if (stepNum === currentStep) {
                    step.classList.add('active');
                }
            });

            // Update content
            document.querySelectorAll('.step-content').forEach((content, index) => {
                content.classList.remove('active');
                if (index + 1 === currentStep) {
                    content.classList.add('active');
                }
            });
        }

        function nextStep() {
            if (currentStep < totalSteps) {
                currentStep++;
                updateProgress();
            }
        }

        function prevStep() {
            if (currentStep > 1) {
                currentStep--;
                updateProgress();
            }
        }

        function toggleCheck(checkbox) {
            checkbox.classList.toggle('checked');
            if (checkbox.classList.contains('checked')) {
                checkbox.innerHTML = '✓';
            } else {
                checkbox.innerHTML = '';
            }
        }

        // Initialize
        updateProgress();
    </script>
</body>
</html>
`;

export const COMPLIANCE_NOTES = {
    title: "Meta WhatsApp Business Platform Compliance",
    requirements: [
        {
            category: "Opt-in Requirements",
            items: [
                "All messaging requires explicit user consent",
                "Users must actively opt-in (no pre-checked boxes)",
                "Consent must be specific to your business",
                "Maintain records of all opt-in consents",
                "Provide clear information about message types"
            ]
        },
        {
            category: "Content Guidelines",
            items: [
                "No spam or unsolicited messages",
                "Messages must be relevant and valuable",
                "Include clear sender identification",
                "Respect cultural and regional sensitivities",
                "Avoid excessive promotional language"
            ]
        },
        {
            category: "User Rights",
            items: [
                "Provide clear unsubscribe instructions",
                "Honor opt-out requests immediately",
                "Support standard opt-out keywords (STOP, UNSUBSCRIBE)",
                "Don't require login to unsubscribe",
                "Confirm successful unsubscription"
            ]
        },
        {
            category: "Technical Requirements",
            items: [
                "Implement proper webhook handling",
                "Maintain message delivery status tracking",
                "Handle rate limits appropriately",
                "Secure API credential storage",
                "Monitor and minimize user blocks/reports"
            ]
        }
    ]
};

export const UI_SUGGESTIONS = {
    onboardingFlow: {
        design: "Clean, modern interface with step-by-step progress",
        colors: "WhatsApp green (#25D366) with professional blue accents",
        layout: "Single-page application with smooth transitions",
        components: [
            "Progress bar with step indicators",
            "Clear call-to-action buttons",
            "Success/error message displays",
            "Loading states for API calls",
            "Responsive design for mobile/desktop"
        ]
    },
    userExperience: {
        principles: [
            "One action per screen to avoid confusion",
            "Clear error messages with actionable solutions",
            "Auto-save progress to prevent data loss",
            "Skip options for advanced users",
            "Help tooltips for complex steps"
        ]
    }
};
