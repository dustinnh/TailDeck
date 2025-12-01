'use client';

import { formatDistanceToNow, format } from 'date-fns';
import {
  X,
  Copy,
  ExternalLink,
  Globe,
  Server,
  Clock,
  AlertTriangle,
  Network,
  Tag,
  User,
} from 'lucide-react';
import { toast } from 'sonner';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import type { MachineNodeData } from './nodes/machine-node';

interface TopologyDetailsPanelProps {
  node: MachineNodeData | null;
  onClose: () => void;
  isOpen: boolean;
}

/**
 * Slide-in panel showing detailed node information
 */
export function TopologyDetailsPanel({ node, onClose, isOpen }: TopologyDetailsPanelProps) {
  if (!node) return null;

  const status = !node.online ? 'offline' : node.isExpiringSoon ? 'expiring' : 'online';

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/50 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={cn(
          'fixed bottom-0 right-0 top-0 z-50 w-[400px] max-w-[90vw] border-l border-border bg-card shadow-2xl',
          'transform transition-transform duration-300 ease-out',
          'flex flex-col',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Header */}
        <header className="sticky top-0 z-10 border-b border-border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <div
                className={cn(
                  'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg',
                  node.online ? 'bg-emerald-500/10' : 'bg-muted',
                  node.isExitNode && 'bg-violet-500/10'
                )}
              >
                {node.isExitNode ? (
                  <Globe className="h-5 w-5 text-violet-500" />
                ) : (
                  <Server
                    className={cn(
                      'h-5 w-5',
                      node.online ? 'text-emerald-500' : 'text-muted-foreground'
                    )}
                  />
                )}
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold">{node.label}</h2>
                <p className="truncate text-sm text-muted-foreground">{node.user}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {node.isExitNode && (
                <Badge className="bg-violet-500 text-xs text-white hover:bg-violet-600">EXIT</Badge>
              )}
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 space-y-6 overflow-y-auto p-4">
          {/* Status Section */}
          <Section title="Status" icon={<Clock className="h-4 w-4" />}>
            <div className="mb-2 flex items-center gap-2">
              <Badge
                variant={
                  status === 'online' ? 'default' : status === 'expiring' ? 'secondary' : 'outline'
                }
                className={cn(
                  status === 'online' && 'bg-emerald-500 hover:bg-emerald-600',
                  status === 'expiring' && 'bg-amber-500 text-white hover:bg-amber-600'
                )}
              >
                {status === 'online' ? 'Online' : status === 'expiring' ? 'Expiring' : 'Offline'}
              </Badge>
              <span className="text-sm text-muted-foreground">
                Last seen {formatDistanceToNow(node.lastSeen, { addSuffix: true })}
              </span>
            </div>
            {node.isExpiringSoon && (
              <Alert className="border-amber-500/50 bg-amber-500/10">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <AlertDescription className="text-amber-600 dark:text-amber-400">
                  Key expires {formatDistanceToNow(node.expiry, { addSuffix: true })}
                </AlertDescription>
              </Alert>
            )}
          </Section>

          {/* Network Section */}
          <Section title="Network" icon={<Network className="h-4 w-4" />}>
            <div className="space-y-2">
              {node.ipAddresses.map((ip) => (
                <div key={ip} className="flex items-center justify-between gap-2">
                  <code className="truncate rounded bg-muted px-2 py-1 font-mono text-sm">
                    {ip}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => copyToClipboard(ip)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </Section>

          {/* User Section */}
          <Section title="Owner" icon={<User className="h-4 w-4" />}>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{node.user}</Badge>
            </div>
          </Section>

          {/* Tags Section */}
          <Section title="Tags" icon={<Tag className="h-4 w-4" />}>
            {node.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {node.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag.replace('tag:', '')}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No tags assigned</p>
            )}
          </Section>

          {/* Routes Section */}
          <Section title="Routes" icon={<Network className="h-4 w-4" />}>
            {node.routes.length > 0 ? (
              <div className="space-y-2">
                {node.routes.map((route) => (
                  <div
                    key={route.id}
                    className={cn(
                      'flex items-center justify-between rounded border p-2',
                      route.enabled ? 'border-primary/30 bg-primary/5' : 'border-muted bg-muted/50'
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <code className="truncate font-mono text-xs">{route.prefix}</code>
                      {route.isPrimary && (
                        <Badge variant="outline" className="px-1 text-[10px]">
                          Primary
                        </Badge>
                      )}
                      {route.isExitRoute && (
                        <Badge variant="outline" className="border-violet-500/50 px-1 text-[10px]">
                          Exit
                        </Badge>
                      )}
                    </div>
                    <Badge variant={route.enabled ? 'default' : 'secondary'} className="text-xs">
                      {route.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No routes advertised</p>
            )}
          </Section>

          {/* Details Section */}
          <Section title="Details">
            <div className="space-y-2 text-sm">
              <InfoRow label="Machine Name" value={node.name} copyable onCopy={copyToClipboard} />
              <InfoRow
                label="Machine Key"
                value={node.machineKey.substring(0, 20) + '...'}
                copyable
                fullValue={node.machineKey}
                onCopy={copyToClipboard}
              />
              <InfoRow label="Register Method" value={formatRegisterMethod(node.registerMethod)} />
              <InfoRow label="Expiry" value={format(node.expiry, 'PPpp')} />
            </div>
          </Section>
        </div>

        {/* Footer Actions */}
        <footer className="sticky bottom-0 border-t border-border bg-card p-4">
          <Button className="w-full" variant="outline" asChild>
            <a href={`/machines?highlight=${node.id}`}>
              <ExternalLink className="mr-2 h-4 w-4" />
              View in Machines
            </a>
          </Button>
        </footer>
      </div>
    </>
  );
}

/**
 * Section component
 */
function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {icon}
        {title}
      </h3>
      <div>{children}</div>
    </div>
  );
}

/**
 * Info row component
 */
function InfoRow({
  label,
  value,
  copyable,
  fullValue,
  onCopy,
}: {
  label: string;
  value: string;
  copyable?: boolean;
  fullValue?: string;
  onCopy?: (text: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">
        <span className="max-w-[180px] truncate font-mono text-xs">{value}</span>
        {copyable && onCopy && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => onCopy(fullValue || value)}
          >
            <Copy className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Format register method for display
 */
function formatRegisterMethod(method: string): string {
  const methods: Record<string, string> = {
    REGISTER_METHOD_UNSPECIFIED: 'Unspecified',
    REGISTER_METHOD_AUTH_KEY: 'Auth Key',
    REGISTER_METHOD_CLI: 'CLI',
    REGISTER_METHOD_OIDC: 'OIDC',
  };
  return methods[method] || method;
}
