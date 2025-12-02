# NetFlow Collection Setup

TailDeck includes built-in support for collecting and visualizing NetFlow data from your Tailscale network. This guide explains how to set up NetFlow exports from your Tailscale nodes.

## Architecture

```
[Tailscale Node] → softflowd → NetFlow v9 → GoFlow2 → TailDeck UI
```

- **softflowd**: Captures network traffic and exports NetFlow data
- **GoFlow2**: Receives NetFlow data and writes it to a JSON file
- **TailDeck**: Reads and displays the flow data in the Logs page

## Server-Side Setup

GoFlow2 is already configured in the TailDeck docker-compose.yml:

```yaml
goflow:
  image: netsampler/goflow2:latest
  container_name: taildeck-goflow
  ports:
    - '2055:2055/udp' # NetFlow
    - '6343:6343/udp' # sFlow
    - '4739:4739/udp' # IPFIX
  volumes:
    - goflow_data:/flows
  command: ['-transport.file', '/flows/flows.json', '-format', 'json']
```

This listens on:

- UDP 2055 for NetFlow v5/v9
- UDP 6343 for sFlow
- UDP 4739 for IPFIX

## Client-Side Setup

Install and configure softflowd on each Tailscale node you want to monitor.

### Ubuntu/Debian

```bash
# Install softflowd
sudo apt update
sudo apt install softflowd

# Start exporting flows from the tailscale0 interface
# Replace YOUR_TAILDECK_SERVER with your TailDeck server's IP or hostname
sudo softflowd -i tailscale0 -n YOUR_TAILDECK_SERVER:2055 -v 9
```

### Make it Persistent with systemd

Create a systemd service to start softflowd automatically:

```bash
cat <<EOF | sudo tee /etc/systemd/system/softflowd-tailscale.service
[Unit]
Description=Softflowd NetFlow exporter for Tailscale
After=network.target tailscaled.service

[Service]
Type=forking
ExecStart=/usr/sbin/softflowd -d -i tailscale0 -n YOUR_TAILDECK_SERVER:2055 -v 9
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Enable and start the service
sudo systemctl daemon-reload
sudo systemctl enable --now softflowd-tailscale
```

### RHEL/CentOS/Fedora

```bash
# Install softflowd (may need EPEL repository)
sudo dnf install epel-release
sudo dnf install softflowd

# Same systemd setup as above
```

### macOS

```bash
# Install via Homebrew
brew install softflowd

# Get the Tailscale interface name (usually utun* on macOS)
IFACE=$(networksetup -listallhardwareports | grep -A1 "Tailscale" | grep Device | awk '{print $2}')

# Start softflowd
sudo softflowd -i $IFACE -n YOUR_TAILDECK_SERVER:2055 -v 9
```

### Alpine Linux

```bash
# Install softflowd
apk add softflowd

# Start with OpenRC
rc-update add softflowd default
rc-service softflowd start
```

## Verifying the Setup

### On the TailDeck server:

1. Check if GoFlow2 is receiving data:

   ```bash
   docker logs taildeck-goflow
   ```

2. Check the flow file:
   ```bash
   docker exec taildeck-goflow cat /flows/flows.json | tail -5
   ```

### On the client node:

1. Check softflowd status:

   ```bash
   sudo softflowctl statistics
   ```

2. Generate some traffic and verify flows are being sent:
   ```bash
   # This should show flow exports in the output
   sudo softflowctl debug
   ```

## Viewing Flow Data in TailDeck

1. Log in to TailDeck
2. Navigate to **Logs** in the navigation bar
3. Select the **Network Flows** tab
4. You should see flow records with:
   - Timestamp
   - Protocol (TCP/UDP/ICMP)
   - Source IP:Port
   - Destination IP:Port
   - Bytes transferred
   - Packet count

## Troubleshooting

### No flow data appearing

1. **Firewall**: Ensure UDP port 2055 is open on the TailDeck server
2. **Interface**: Verify softflowd is monitoring the correct interface (tailscale0)
3. **Network path**: Confirm the client can reach the server on UDP 2055

### Test connectivity:

```bash
# From a client node
nc -u YOUR_TAILDECK_SERVER 2055
```

### High volume of flows

If you have high traffic, consider:

- Adjusting the sampling rate in softflowd: `-T full` (default) or `-T pcap`
- Increasing the flow timeout: `-t maxlife=300`
- Filtering specific traffic with BPF: `-b "port 22"`

## Advanced Configuration

### Monitoring specific traffic only

You can use BPF filters with softflowd:

```bash
# Only monitor SSH traffic
sudo softflowd -i tailscale0 -n YOUR_SERVER:2055 -v 9 -b "port 22"

# Exclude DNS traffic
sudo softflowd -i tailscale0 -n YOUR_SERVER:2055 -v 9 -b "not port 53"
```

### Multiple interfaces

Run multiple softflowd instances for different interfaces:

```bash
sudo softflowd -i eth0 -n YOUR_SERVER:2055 -v 9
sudo softflowd -i tailscale0 -n YOUR_SERVER:2055 -v 9
```

## References

- [softflowd documentation](https://github.com/irino/softflowd)
- [GoFlow2 documentation](https://github.com/netsampler/goflow2)
- [NetFlow v9 specification](https://www.cisco.com/en/US/technologies/tk648/tk362/technologies_white_paper09186a00800a3db9.html)
