'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

import { StepIndicator } from './components/step-indicator';
import { CompletionStep } from './steps/completion-step';
import { DnsStep } from './steps/dns-step';
import { DomainStep } from './steps/domain-step';
import { SecurityStep } from './steps/security-step';
import { WelcomeStep } from './steps/welcome-step';

interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  message: string;
  latencyMs?: number;
}

interface SecurityWarning {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  remediation?: string;
  canDismiss: boolean;
}

interface Diagnostics {
  overall: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  timestamp: string;
  services: {
    database: ServiceHealth;
    headscale: ServiceHealth;
    oidc: ServiceHealth;
  };
  counts: {
    nodes: number;
    users: number;
    routes: number;
  };
  securityWarnings: SecurityWarning[];
  environment: {
    nodeEnv: string;
    authUrl: string;
    headscaleUrl: string;
    magicDnsEnabled: boolean;
    magicDnsDomain?: string;
  };
}

const STEPS = [
  { id: 1, title: 'Welcome' },
  { id: 2, title: 'Domain' },
  { id: 3, title: 'DNS' },
  { id: 4, title: 'Security' },
  { id: 5, title: 'Complete' },
];

export function SetupWizardClient() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const [warnings, setWarnings] = useState<SecurityWarning[]>([]);
  const [isCompleting, setIsCompleting] = useState(false);

  // Fetch diagnostics on mount
  useEffect(() => {
    async function fetchDiagnostics() {
      try {
        const response = await fetch('/api/setup/diagnostics');
        if (!response.ok) throw new Error('Failed to fetch diagnostics');
        const data = await response.json();
        setDiagnostics(data);
        setWarnings(data.securityWarnings || []);
      } catch {
        toast.error('Failed to load diagnostics. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    fetchDiagnostics();
  }, []);

  const handleDismissWarning = async (warningId: string) => {
    try {
      const response = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dismiss-warning', warningId }),
      });

      if (!response.ok) throw new Error('Failed to dismiss warning');

      setWarnings((prev) => prev.filter((w) => w.id !== warningId));
      toast.success('Warning dismissed');
    } catch {
      toast.error('Failed to dismiss warning.');
    }
  };

  const handleComplete = async () => {
    setIsCompleting(true);
    try {
      const response = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete' }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to complete setup');
      }

      toast.success('Setup Complete! TailDeck is now fully configured.');

      // Redirect to dashboard
      router.push('/dashboard');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to complete setup');
    } finally {
      setIsCompleting(false);
    }
  };

  const goToStep = (step: number) => {
    if (step >= 1 && step <= STEPS.length) {
      setCurrentStep(step);
    }
  };

  const nextStep = () => goToStep(currentStep + 1);
  const prevStep = () => goToStep(currentStep - 1);

  if (loading) {
    return (
      <Card className="mx-auto max-w-2xl">
        <CardContent className="flex h-64 items-center justify-center">
          <div className="text-center">
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-muted-foreground">Loading diagnostics...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!diagnostics) {
    return (
      <Card className="mx-auto max-w-2xl">
        <CardContent className="flex h-64 items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground">
              Failed to load diagnostics. Please refresh the page.
            </p>
            <Button className="mt-4" onClick={() => window.location.reload()}>
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasBlockingIssues = warnings.some((w) => w.severity === 'critical' && !w.canDismiss);

  return (
    <Card className="mx-auto max-w-2xl">
      <CardContent className="p-6">
        <StepIndicator steps={STEPS} currentStep={currentStep} onStepClick={goToStep} />

        <div className="min-h-[400px]">
          {currentStep === 1 && <WelcomeStep diagnostics={diagnostics} />}
          {currentStep === 2 && <DomainStep environment={diagnostics.environment} />}
          {currentStep === 3 && <DnsStep environment={diagnostics.environment} />}
          {currentStep === 4 && (
            <SecurityStep warnings={warnings} onDismissWarning={handleDismissWarning} />
          )}
          {currentStep === 5 && (
            <CompletionStep
              onComplete={handleComplete}
              isCompleting={isCompleting}
              hasBlockingIssues={hasBlockingIssues}
            />
          )}
        </div>

        {/* Navigation */}
        {currentStep < 5 && (
          <div className="mt-8 flex justify-between">
            <Button variant="outline" onClick={prevStep} disabled={currentStep === 1}>
              Previous
            </Button>
            <Button onClick={nextStep}>{currentStep === 4 ? 'Review & Complete' : 'Next'}</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
