'use client';

import { useRouter } from 'next/navigation';
import { Rocket, Plus, ArrowRight, Sparkles } from 'lucide-react';

interface NoAppEmptyStateProps {
  title?: string;
  description?: string;
  showIllustration?: boolean;
}

export default function NoAppEmptyState({
  title = 'Get Started with Your First App',
  description = 'Create an app to start setting up your chatbot workflows, FAQs, service plans, and integrations. Each app is tailored to your specific industry and business needs.',
  showIllustration = true
}: NoAppEmptyStateProps) {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 py-12">
      <div className="max-w-2xl w-full text-center">
        {showIllustration && (
          <div className="mb-8 flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-[#00bc7d] to-[#00a66d] rounded-full blur-2xl opacity-20 animate-pulse"></div>
              <div className="relative bg-gradient-to-br from-[#00bc7d] to-[#00a66d] rounded-full p-8">
                <Rocket className="h-16 w-16 text-white" />
              </div>
              <div className="absolute -top-2 -right-2">
                <Sparkles className="h-8 w-8 text-yellow-400 animate-bounce" />
              </div>
            </div>
          </div>
        )}

        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          {title}
        </h2>
        
        <p className="text-lg text-gray-600 mb-8 leading-relaxed">
          {description}
        </p>

        <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-lg p-6 mb-8 border border-blue-100">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 mt-1">
              <div className="h-10 w-10 rounded-full bg-[#00bc7d] flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
            </div>
            <div className="flex-1 text-left">
              <h3 className="font-semibold text-gray-900 mb-2">What you'll get:</h3>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-center gap-2">
                  <span className="text-[#00bc7d]">✓</span>
                  <span>Industry-specific chatbot workflows and conversation flows</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[#00bc7d]">✓</span>
                  <span>Pre-configured FAQs and training data</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[#00bc7d]">✓</span>
                  <span>Service plans</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[#00bc7d]">✓</span>
                  <span>Integration settings and widget customization</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <button
          onClick={() => router.push('/apps/create')}
          className="btn-primary inline-flex items-center gap-2 text-lg px-8 py-4 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
        >
          <Plus className="h-5 w-5" />
          Create Your First App
          <ArrowRight className="h-5 w-5" />
        </button>

        <p className="mt-6 text-sm text-gray-500">
          It only takes a few minutes to set up and you can customize everything later
        </p>
      </div>
    </div>
  );
}
