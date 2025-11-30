import { MyDevicesClient } from './my-devices-client';

export const metadata = {
  title: 'My Devices - TailDeck',
  description: 'View and manage your personal devices in the network',
};

/**
 * My Devices Page (User Portal)
 *
 * Shows devices owned by the current user.
 * Available to all authenticated users (USER role and above).
 */
export default function MyDevicesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Devices</h1>
        <p className="text-muted-foreground">
          View and manage your devices connected to the network.
        </p>
      </div>
      <MyDevicesClient />
    </div>
  );
}
