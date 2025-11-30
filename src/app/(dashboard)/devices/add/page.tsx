import { AddDeviceClient } from './add-device-client';

export const metadata = {
  title: 'Add Device - TailDeck',
  description: 'Generate a preauth key to add a new device to your network',
};

/**
 * Add Device Page
 *
 * Wizard for creating preauth keys with QR code display.
 * OPERATOR+ only.
 */
export default function AddDevicePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Add Device</h1>
        <p className="text-muted-foreground">
          Generate a preauth key to register a new device in your network.
        </p>
      </div>
      <AddDeviceClient />
    </div>
  );
}
