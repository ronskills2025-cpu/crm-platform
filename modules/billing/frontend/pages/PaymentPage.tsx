import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, QrCode, Smartphone, CreditCard, CheckCircle, AlertTriangle, Copy, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';

interface PricingPlan {
  id: string;
  name: string;
  price: number;
  description: string;
}

interface PaymentConfig {
  qrCodeUrl: string;
  upiId: string;
  merchantName: string;
}

interface UserFormData {
  name: string;
  phone: string;
  email: string;
  notes?: string;
}

const pricingPlans: Record<string, PricingPlan> = {
  starter: { id: 'starter', name: 'Starter', price: 999, description: 'Perfect for small businesses' },
  growth: { id: 'growth', name: 'Growth', price: 2499, description: 'Ideal for growing businesses' },
  professional: { id: 'professional', name: 'Professional', price: 4999, description: 'For established businesses' },
  enterprise: { id: 'enterprise', name: 'Enterprise', price: 9999, description: 'For large organizations' },
  scale: { id: 'scale', name: 'Scale', price: 19999, description: 'Maximum performance' },
  unlimited: { id: 'unlimited', name: 'Unlimited', price: 39999, description: 'No limits, maximum scale' }
};

function formatPrice(price: number) {
  return new Intl.NumberFormat('en-IN', { 
    style: 'currency', 
    currency: 'INR', 
    maximumFractionDigits: 0 
  }).format(price);
}

export default function PaymentPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const planId = searchParams.get('plan');
  
  const [step, setStep] = useState<'form' | 'payment'>('form');
  const [loading, setLoading] = useState(false);
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null);
  const [formData, setFormData] = useState<UserFormData>({
    name: '',
    phone: '',
    email: '',
    notes: ''
  });

  const selectedPlan = planId ? pricingPlans[planId] : null;

  useEffect(() => {
    if (!selectedPlan) {
      toast.error('Invalid plan selected');
      navigate('/billing');
    }
  }, [selectedPlan, navigate]);

  // Fetch payment configuration from admin
  const fetchPaymentConfig = async () => {
    try {
      // This would normally fetch from your API
      // For now, using mock data
      const mockConfig: PaymentConfig = {
        qrCodeUrl: '/api/admin/payment-qr', // This should be dynamically uploaded by admin
        upiId: 'business@paytm', // This should be configurable by admin
        merchantName: 'MSG CRM Platform'
      };
      setPaymentConfig(mockConfig);
    } catch (error) {
      toast.error('Failed to load payment configuration');
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.phone || !formData.email) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!/^\d{10}$/.test(formData.phone)) {
      toast.error('Please enter a valid 10-digit phone number');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    setLoading(true);
    
    try {
      // Save payment request to database
      const paymentRequest = {
        planId: selectedPlan?.id,
        planName: selectedPlan?.name,
        amount: selectedPlan?.price,
        userDetails: formData,
        timestamp: new Date().toISOString(),
        status: 'pending'
      };

      // This would normally be an API call
      console.log('Payment request:', paymentRequest);
      
      // Fetch payment config and proceed to payment step
      await fetchPaymentConfig();
      setStep('payment');
      toast.success('Form submitted! Please complete the payment below.');
      
    } catch (error) {
      toast.error('Failed to process form. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const generateUPILink = () => {
    if (!paymentConfig || !selectedPlan) return '';
    
    const params = new URLSearchParams({
      pa: paymentConfig.upiId,
      pn: paymentConfig.merchantName,
      am: selectedPlan.price.toString(),
      cu: 'INR',
      tn: `Payment for ${selectedPlan.name} Plan - ${formData.name}`
    });

    return `upi://pay?${params.toString()}`;
  };

  const handlePaymentClick = () => {
    const upiLink = generateUPILink();
    
    try {
      // Try to open UPI app
      window.location.href = upiLink;
      
      // Show success message
      toast.success('Opening payment app... Complete the payment and contact support for activation.');
      
      // Optionally redirect back to billing after some time
      setTimeout(() => {
        navigate('/billing');
      }, 3000);
      
    } catch (error) {
      toast.error('Unable to open payment app. Please scan the QR code manually.');
    }
  };

  const copyUPIId = () => {
    if (paymentConfig?.upiId) {
      navigator.clipboard.writeText(paymentConfig.upiId);
      toast.success('UPI ID copied to clipboard!');
    }
  };

  if (!selectedPlan) {
    return null;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => step === 'payment' ? setStep('form') : navigate('/billing')}
          className="p-2 rounded-lg border border-[var(--border-default)] hover:bg-[var(--bg-hover)] transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            {step === 'form' ? 'Payment Details' : 'Complete Payment'}
          </h1>
          <p className="text-[var(--text-secondary)]">
            {selectedPlan.name} Plan - {formatPrice(selectedPlan.price)}/month
          </p>
        </div>
      </div>

      {/* Progress Indicator */}
      <div className="flex items-center gap-4">
        <div className={`flex items-center gap-2 ${step === 'form' ? 'text-[var(--accent-primary)]' : 'text-[var(--status-success)]'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
            step === 'form' ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10' : 'border-[var(--status-success)] bg-[var(--status-success)]/10'
          }`}>
            {step === 'payment' ? <CheckCircle size={16} /> : '1'}
          </div>
          <span className="font-medium">Details</span>
        </div>
        <div className="flex-1 h-px bg-[var(--border-default)]" />
        <div className={`flex items-center gap-2 ${step === 'payment' ? 'text-[var(--accent-primary)]' : 'text-[var(--text-muted)]'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
            step === 'payment' ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10' : 'border-[var(--border-default)]'
          }`}>
            2
          </div>
          <span className="font-medium">Payment</span>
        </div>
      </div>

      {step === 'form' ? (
        /* User Form */
        <form onSubmit={handleFormSubmit} className="space-y-6">
          <div className="bg-[var(--bg-surface)] rounded-xl p-6 border border-[var(--border-default)]">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Contact Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent"
                  placeholder="Enter your full name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-4 py-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent"
                  placeholder="10-digit phone number"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                Email Address *
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="w-full px-4 py-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent"
                placeholder="your.email@example.com"
              />
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                Additional Notes (Optional)
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
                className="w-full px-4 py-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent"
                placeholder="Any special requirements or notes..."
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-6 bg-[var(--accent-primary)] text-white rounded-xl font-semibold hover:bg-[var(--accent-primary)]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Processing...
              </div>
            ) : (
              'Continue to Payment'
            )}
          </button>
        </form>
      ) : (
        /* Payment Step */
        <div className="space-y-6">
          {/* Plan Summary */}
          <div className="bg-[var(--bg-surface)] rounded-xl p-6 border border-[var(--border-default)]">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Payment Summary</h2>
            <div className="flex justify-between items-center">
              <div>
                <p className="font-medium text-[var(--text-primary)]">{selectedPlan.name} Plan</p>
                <p className="text-sm text-[var(--text-muted)]">{selectedPlan.description}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-[var(--text-primary)]">{formatPrice(selectedPlan.price)}</p>
                <p className="text-sm text-[var(--text-muted)]">per month</p>
              </div>
            </div>
          </div>

          {/* QR Code Payment */}
          <div className="bg-[var(--bg-surface)] rounded-xl p-6 border border-[var(--border-default)]">
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
                <QrCode size={32} />
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">Scan QR Code to Pay</h3>
                <p className="text-[var(--text-secondary)]">Use any UPI app to scan and pay</p>
              </div>

              {/* QR Code Display */}
              <div className="bg-white p-4 rounded-lg inline-block border">
                {paymentConfig?.qrCodeUrl ? (
                  <img 
                    src={paymentConfig.qrCodeUrl} 
                    alt="Payment QR Code" 
                    className="w-48 h-48 mx-auto"
                    onError={() => toast.error('Failed to load QR code')}
                  />
                ) : (
                  <div className="w-48 h-48 bg-gray-200 rounded-lg flex items-center justify-center">
                    <div className="text-center text-gray-500">
                      <QrCode size={48} />
                      <p className="mt-2 text-sm">QR Code Loading...</p>
                    </div>
                  </div>
                )}
              </div>

              {/* UPI ID */}
              {paymentConfig?.upiId && (
                <div className="bg-[var(--bg-elevated)] rounded-lg p-4">
                  <p className="text-sm text-[var(--text-muted)] mb-2">Or pay directly to UPI ID:</p>
                  <div className="flex items-center gap-2 justify-center">
                    <code className="bg-[var(--bg-input)] px-3 py-1 rounded text-[var(--text-primary)]">
                      {paymentConfig.upiId}
                    </code>
                    <button
                      onClick={copyUPIId}
                      className="p-1 hover:bg-[var(--bg-hover)] rounded transition-colors"
                      title="Copy UPI ID"
                    >
                      <Copy size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* Pay Button */}
              <button
                onClick={handlePaymentClick}
                className="w-full py-3 px-6 bg-[var(--accent-primary)] text-white rounded-xl font-semibold hover:bg-[var(--accent-primary)]/90 transition-colors flex items-center justify-center gap-2"
              >
                <Smartphone size={20} />
                Pay {formatPrice(selectedPlan.price)}
                <ExternalLink size={16} />
              </button>

              <div className="bg-[var(--status-warning)]/10 border border-[var(--status-warning)]/20 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle size={20} className="text-[var(--status-warning)] flex-shrink-0 mt-0.5" />
                  <div className="text-left">
                    <p className="font-medium text-[var(--text-primary)]">Important</p>
                    <p className="text-sm text-[var(--text-secondary)] mt-1">
                      After completing the payment, please contact our support team with your transaction details for account activation.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
