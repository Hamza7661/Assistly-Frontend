import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

interface ProgressStep {
  id: string;
  label: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
}

interface AppCreationProgressModalProps {
  isOpen: boolean;
  onComplete?: () => void;
  onError?: (error: string) => void;
}

export default function AppCreationProgressModal({ 
  isOpen, 
  onComplete,
  onError 
}: AppCreationProgressModalProps) {
  const [steps, setSteps] = useState<ProgressStep[]>([
    { id: 'initializing', label: 'Initializing seed data', status: 'pending' },
    { id: 'workflows', label: 'Creating conversation workflows', status: 'pending' },
    { id: 'faqs', label: 'Setting up FAQs', status: 'pending' },
    { id: 'servicePlans', label: 'Configuring service plans', status: 'pending' },
    { id: 'leadTypes', label: 'Setting up lead types', status: 'pending' },
  ]);
  
  const [currentStep, setCurrentStep] = useState<string>('');
  const [percentage, setPercentage] = useState(0);
  const [message, setMessage] = useState('');
  const [hasError, setHasError] = useState(false);

  const handleProgress = (data: any) => {
    const { step, message: msg, percentage: pct, progress, total } = data;
    
    console.log('Progress received:', { step, message: msg, percentage: pct });
    
    setCurrentStep(step);
    setMessage(msg || '');
    setPercentage(pct || Math.round((progress / total) * 100));

    // Update steps using functional update to avoid stale closure
    setSteps(prevSteps => {
      const stepIndex = prevSteps.findIndex(st => st.id === step);
      
      return prevSteps.map((s, index) => {
        // Mark all previous steps as completed
        if (index < stepIndex) {
          return { ...s, status: 'completed' as const };
        }
        // Mark current step as in-progress
        else if (s.id === step) {
          return { ...s, status: 'in-progress' as const };
        }
        // Keep future steps as pending
        return s;
      });
    });

    // If complete
    if (step === 'complete') {
      setSteps(prevSteps => prevSteps.map(s => ({ ...s, status: 'completed' as const })));
      setTimeout(() => {
        onComplete?.();
      }, 1500);
    }

    // If error
    if (step === 'error') {
      setHasError(true);
      setSteps(prevSteps => {
        const errorStepIndex = prevSteps.findIndex(s => s.status === 'in-progress');
        if (errorStepIndex !== -1) {
          return prevSteps.map((s, idx) => 
            idx === errorStepIndex ? { ...s, status: 'error' as const } : s
          );
        }
        return prevSteps;
      });
      onError?.(msg || 'An error occurred');
    }
  };

  useEffect(() => {
    if (!isOpen) {
      // Reset state when modal closes
      setSteps([
        { id: 'initializing', label: 'Initializing seed data', status: 'pending' },
        { id: 'workflows', label: 'Creating conversation workflows', status: 'pending' },
        { id: 'faqs', label: 'Setting up FAQs', status: 'pending' },
        { id: 'servicePlans', label: 'Configuring service plans', status: 'pending' },
        { id: 'leadTypes', label: 'Setting up lead types', status: 'pending' },
      ]);
      setPercentage(0);
      setMessage('');
      setHasError(false);
      return;
    }

    console.log('Modal opened, listening for progress events');
    
    // Show initial progress
    setMessage('Initializing seed data...');
    setPercentage(0);

    // Listen for WebSocket progress updates
    const handleProgressEvent = (event: CustomEvent) => {
      console.log('Received progress event:', event.detail);
      handleProgress(event.detail);
    };

    window.addEventListener('app_creation_progress' as any, handleProgressEvent);

    return () => {
      console.log('Removing progress event listener');
      window.removeEventListener('app_creation_progress' as any, handleProgressEvent);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden transform transition-all">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#00bc7d] to-[#00a86b] p-8 text-white">
          <h2 className="text-3xl font-bold mb-2">Creating Your App</h2>
          <p className="text-white/90">Setting up your personalized app with industry-specific data...</p>
        </div>

        {/* Progress Bar */}
        <div className="px-8 pt-6">
          <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#00bc7d] to-[#00a86b] transition-all duration-500 ease-out rounded-full"
              style={{ width: `${percentage}%` }}
            >
              <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
            </div>
          </div>
          <div className="flex justify-between items-center mt-2">
            <span className="text-sm font-medium text-gray-600">{message}</span>
            <span className="text-sm font-bold text-[#00bc7d]">{percentage}%</span>
          </div>
        </div>

        {/* Steps List */}
        <div className="p-8 space-y-4">
          {steps.map((step, index) => (
            <div 
              key={step.id}
              className={`flex items-start gap-4 transition-all duration-300 ${
                step.status === 'in-progress' ? 'scale-105' : ''
              }`}
            >
              {/* Icon */}
              <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                step.status === 'completed' 
                  ? 'bg-green-100 text-green-600' 
                  : step.status === 'in-progress'
                  ? 'bg-[#00bc7d] text-white animate-pulse'
                  : step.status === 'error'
                  ? 'bg-red-100 text-red-600'
                  : 'bg-gray-100 text-gray-400'
              }`}>
                {step.status === 'completed' ? (
                  <CheckCircle2 className="w-6 h-6" />
                ) : step.status === 'in-progress' ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : step.status === 'error' ? (
                  <AlertCircle className="w-6 h-6" />
                ) : (
                  <span className="text-sm font-semibold">{index + 1}</span>
                )}
              </div>

              {/* Label */}
              <div className="flex-1 pt-2">
                <p className={`font-medium transition-colors duration-300 ${
                  step.status === 'completed'
                    ? 'text-green-600'
                    : step.status === 'in-progress'
                    ? 'text-[#00bc7d]'
                    : step.status === 'error'
                    ? 'text-red-600'
                    : 'text-gray-400'
                }`}>
                  {step.label}
                </p>
                {step.status === 'in-progress' && (
                  <p className="text-sm text-gray-500 mt-1 animate-pulse">
                    Processing...
                  </p>
                )}
                {step.status === 'completed' && (
                  <p className="text-sm text-green-600 mt-1">
                    ✓ Completed
                  </p>
                )}
                {step.status === 'error' && (
                  <p className="text-sm text-red-600 mt-1">
                    Failed
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer Message */}
        {!hasError && (
          <div className="px-8 pb-8">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <span className="font-semibold">💡 Tip:</span> Your app will have pre-configured workflows, 
                lead types, and service plans tailored to your industry!
              </p>
            </div>
          </div>
        )}

        {hasError && (
          <div className="px-8 pb-8">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">
                <span className="font-semibold">⚠️ Error:</span> Something went wrong during app creation. 
                Please try again.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
