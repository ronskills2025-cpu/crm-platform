import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, CheckCircle, Star, Zap, Crown, Rocket, MessageCircle, Lock, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

interface Service {
  id: string;
  name: string;
  description: string;
  icon: any;
  active: boolean;
  comingSoon?: boolean;
}

interface PricingPlan {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  period: string;
  description: string;
  features: string[];
  popular?: boolean;
  recommended?: boolean;
}

const services: Service[] = [
  {
    id: 'whatsapp',
    name: 'WhatsApp API',
    description: 'Send messages, manage conversations, and automate workflows',
    icon: MessageCircle,
    active: true,
  },
  {
    id: 'sms',
    name: 'SMS Gateway',
    description: 'Global SMS delivery with multiple provider support',
    icon: Lock,
    active: false,
    comingSoon: true,
  },
  {
    id: 'email',
    name: 'Email Marketing',
    description: 'Professional email campaigns and automation',
    icon: Lock,
    active: false,
    comingSoon: true,
  },
  {
    id: 'voice',
    name: 'Voice Calls',
    description: 'Automated voice calls and IVR systems',
    icon: Lock,
    active: false,
    comingSoon: true,
  },
];

const whatsappPlans: PricingPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 999,
    period: 'month',
    description: 'Perfect for small businesses getting started',
    features: [
      '1 WhatsApp Number',
      '1,000 Messages/month',
      'Basic Templates',
      'Contact Management',
      'Email Support'
    ]
  },
  {
    id: 'growth',
    name: 'Growth',
    price: 2499,
    period: 'month',
    description: 'Ideal for growing businesses',
    popular: true,
    features: [
      '3 WhatsApp Numbers',
      '5,000 Messages/month',
      'Advanced Templates',
      'Automation Rules',
      'Analytics Dashboard',
      'Priority Support'
    ]
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 4999,
    period: 'month',
    description: 'For established businesses',
    features: [
      '5 WhatsApp Numbers',
      '15,000 Messages/month',
      'Custom Templates',
      'Advanced Automation',
      'Team Collaboration',
      'API Access',
      'Phone Support'
    ]
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 9999,
    period: 'month',
    description: 'For large organizations',
    recommended: true,
    features: [
      '10 WhatsApp Numbers',
      '50,000 Messages/month',
      'Unlimited Templates',
      'AI-Powered Automation',
      'Advanced Analytics',
      'White-label Solution',
      'Dedicated Manager'
    ]
  },
  {
    id: 'scale',
    name: 'Scale',
    price: 19999,
    period: 'month',
    description: 'Maximum performance and features',
    features: [
      '25 WhatsApp Numbers',
      '100,000 Messages/month',
      'Custom Integrations',
      'Advanced AI Features',
      'Multi-tenant Support',
      'SLA Guarantee',
      '24/7 Premium Support'
    ]
  },
  {
    id: 'unlimited',
    name: 'Unlimited',
    price: 39999,
    period: 'month',
    description: 'No limits, maximum scale',
    features: [
      'Unlimited Numbers',
      'Unlimited Messages',
      'Everything Included',
      'Custom Development',
      'On-premise Option',
      'Dedicated Infrastructure',
      'White-glove Support'
    ]
  }
];

function formatPrice(price: number) {
  return new Intl.NumberFormat('en-IN', { 
    style: 'currency', 
    currency: 'INR', 
    maximumFractionDigits: 0 
  }).format(price);
}

export default function BillingPage() {
  const navigate = useNavigate();
  const [selectedService, setSelectedService] = useState<string>('whatsapp');
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const currentPlans = selectedService === 'whatsapp' ? whatsappPlans : [];

  const handleSelectPlan = async (planId: string) => {
    setLoading(true);
    setSelectedPlan(planId);
    
    try {
      // Show success toast
      const plan = currentPlans.find(p => p.id === planId);
      toast.success(`${plan?.name} plan selected! Redirecting to payment...`);
      
      // Simulate brief loading then redirect to payment page
      setTimeout(() => {
        navigate(`/billing/payment?plan=${planId}`);
      }, 1500);
      
    } catch (error) {
      toast.error('Failed to select plan. Please try again.');
      setLoading(false);
      setSelectedPlan(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-[var(--text-primary)]">Choose Your Service & Plan</h1>
        <p className="text-[var(--text-secondary)] mt-2">
          Select a service first, then choose the perfect plan for your business needs
        </p>
      </div>

      {/* Service Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {services.map((service) => (
          <div
            key={service.id}
            onClick={() => service.active && setSelectedService(service.id)}
            className={`relative p-6 rounded-xl border-2 transition-all duration-200 cursor-pointer ${
              selectedService === service.id && service.active
                ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/5'
                : service.active
                ? 'border-[var(--border-default)] bg-[var(--bg-surface)] hover:border-[var(--accent-primary)]/50'
                : 'border-[var(--border-default)] bg-[var(--bg-muted)] opacity-60 cursor-not-allowed'
            }`}
          >
            <div className="text-center">
              <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4 ${
                service.active 
                  ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                  : 'bg-[var(--bg-muted)] text-[var(--text-muted)]'
              }`}>
                <service.icon size={24} />
              </div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">{service.name}</h3>
              <p className="text-sm text-[var(--text-muted)] mb-4">{service.description}</p>
              
              {service.comingSoon && (
                <span className="inline-block px-3 py-1 text-xs font-medium bg-[var(--status-warning)]/10 text-[var(--status-warning)] rounded-full">
                  Coming Soon
                </span>
              )}
              
              {service.active && selectedService === service.id && (
                <div className="absolute top-3 right-3">
                  <CheckCircle size={20} className="text-[var(--accent-primary)]" />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Plans Section */}
      {selectedService && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">
              {services.find(s => s.id === selectedService)?.name} Plans
            </h2>
            <p className="text-[var(--text-secondary)] mt-1">
              Choose the plan that fits your business scale
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {currentPlans.map((plan) => (
          <div
            key={plan.id}
            className={`relative rounded-2xl border p-6 transition-all duration-200 hover:shadow-lg ${
              plan.popular
                ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/5 ring-2 ring-[var(--accent-primary)]/20'
                : plan.recommended
                ? 'border-[var(--status-warning)] bg-[var(--status-warning)]/5 ring-2 ring-[var(--status-warning)]/20'
                : 'border-[var(--border-default)] bg-[var(--bg-surface)] hover:border-[var(--border-hover)]'
            }`}
          >
            {/* Popular Badge */}
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-[var(--accent-primary)] text-white px-3 py-1 rounded-full text-xs font-semibold">
                  Most Popular
                </span>
              </div>
            )}

            {/* Recommended Badge */}
            {plan.recommended && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-[var(--status-warning)] text-white px-3 py-1 rounded-full text-xs font-semibold">
                  Recommended
                </span>
              </div>
            )}

            {/* Plan Header */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] mb-4">
                <MessageCircle size={24} />
              </div>
              <h3 className="text-xl font-bold text-[var(--text-primary)]">{plan.name}</h3>
              <p className="text-sm text-[var(--text-muted)] mt-1">{plan.description}</p>
            </div>

            {/* Pricing */}
            <div className="text-center mb-6">
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-3xl font-bold text-[var(--text-primary)]">
                  {formatPrice(plan.price)}
                </span>
                <span className="text-[var(--text-muted)]">/{plan.period}</span>
              </div>
              {plan.originalPrice && (
                <div className="text-sm text-[var(--text-muted)] line-through">
                  {formatPrice(plan.originalPrice)}
                </div>
              )}
            </div>

            {/* Features */}
            <ul className="space-y-3 mb-8">
              {plan.features.map((feature, index) => (
                <li key={index} className="flex items-center gap-3">
                  <CheckCircle size={16} className="text-[var(--status-success)] flex-shrink-0" />
                  <span className="text-sm text-[var(--text-secondary)]">{feature}</span>
                </li>
              ))}
            </ul>

            {/* Select Button */}
            <button
              onClick={() => handleSelectPlan(plan.id)}
              disabled={loading && selectedPlan === plan.id}
              className={`w-full py-3 px-4 rounded-xl font-semibold transition-all duration-200 ${
                plan.popular || plan.recommended
                  ? 'bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/90 shadow-lg hover:shadow-xl'
                  : 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-default)] hover:bg-[var(--bg-hover)] hover:border-[var(--accent-primary)]'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {loading && selectedPlan === plan.id ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Selecting...
                </div>
              ) : (
                <>
                  <CreditCard size={16} className="inline mr-2" />
                  Select {plan.name}
                </>
              )}
            </button>
          </div>
        ))}
      </div>

          {/* Additional Info */}
          <div className="text-center space-y-4">
            <div className="bg-[var(--bg-elevated)] rounded-xl p-6 border border-[var(--border-default)]">
              <h3 className="font-semibold text-[var(--text-primary)] mb-2">All plans include:</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-[var(--text-secondary)]">
                <div className="flex items-center gap-2">
                  <CheckCircle size={14} className="text-[var(--status-success)]" />
                  SSL Security
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle size={14} className="text-[var(--status-success)]" />
                  99.9% Uptime SLA
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle size={14} className="text-[var(--status-success)]" />
                  Regular Backups
                </div>
              </div>
            </div>
            
            <p className="text-sm text-[var(--text-muted)]">
              Need a custom plan? <a href="mailto:sales@msgcrm.com" className="text-[var(--accent-primary)] hover:underline">Contact our sales team</a>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
