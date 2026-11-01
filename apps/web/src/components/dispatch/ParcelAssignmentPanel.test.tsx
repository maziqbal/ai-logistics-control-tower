import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ParcelAssignmentPanel } from './ParcelAssignmentPanel';
import type { DeliveryStop, Parcel } from '../../api/logistics-api';

const parcel = {
  id: 'parcel-001',
  deliveryDayId: 'day-001',
  stopId: null,
  trackingNumber: 'ALT-TEST-001',
  destination: 'Helsinki Central Railway Station',
  locationKey: 'helsinki-central',
  position: null,
  status: 'pending',
  failureReason: null,
} as Parcel;

const stop = {
  id: 'stop-001',
  routeId: 'route-001',
  deliveryDayId: 'day-001',
  sequence: 1,
  locationKey: 'helsinki-central',
  position: null,
  status: 'pending',
} as DeliveryStop;

function renderPanel(overrides: Partial<React.ComponentProps<typeof ParcelAssignmentPanel>> = {}) {
  const onAssign = vi.fn(async () => {});

  const props = {
    parcels: [parcel],
    stops: [stop],
    routeLabel: 'Route 1',
    onAssign,
    ...overrides,
  };

  const view = render(<ParcelAssignmentPanel {...props} />);

  return { ...view, onAssign };
}

describe('ParcelAssignmentPanel', () => {
  it('allows assigning an unassigned parcel to a route stop', async () => {
    const user = userEvent.setup();
    const { onAssign } = renderPanel();

    await user.selectOptions(screen.getByLabelText('Unassigned Parcel'), 'parcel-001');
    await user.selectOptions(screen.getByLabelText('Destination Stop'), 'stop-001');
    await user.click(screen.getByRole('button', { name: 'Assign Parcel' }));

    await waitFor(() => {
      expect(onAssign).toHaveBeenCalledWith('parcel-001', 'stop-001');
    });

    expect(await screen.findByText('Parcel assigned successfully.')).toBeInTheDocument();
  });

  it('displays an error when the assignment fails', async () => {
    const user = userEvent.setup();
    const onAssign = vi.fn().mockRejectedValue(new Error('Server rejected assignment'));

    renderPanel({ onAssign });

    await user.selectOptions(screen.getByLabelText('Unassigned Parcel'), 'parcel-001');
    await user.selectOptions(screen.getByLabelText('Destination Stop'), 'stop-001');
    await user.click(screen.getByRole('button', { name: 'Assign Parcel' }));

    expect(await screen.findByText('Server rejected assignment')).toBeInTheDocument();
    expect(screen.queryByText('Parcel assigned successfully.')).not.toBeInTheDocument();
  });

  it('does not allow assignment without both selections', () => {
    const { onAssign } = renderPanel();

    const button = screen.getByRole('button', { name: 'Assign Parcel' });

    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onAssign).not.toHaveBeenCalled();
  });

  it('does not offer already assigned parcels', () => {
    renderPanel({
      parcels: [{ ...parcel, stopId: 'stop-001' }],
    });

    expect(screen.getByText('No unassigned parcels available.')).toBeInTheDocument();
    expect(screen.queryByText('ALT-TEST-001')).not.toBeInTheDocument();
  });

  it('resets selections when the route key changes', async () => {
    const user = userEvent.setup();
    const { rerender, onAssign } = renderPanel();

    await user.selectOptions(screen.getByLabelText('Unassigned Parcel'), 'parcel-001');
    await user.selectOptions(screen.getByLabelText('Destination Stop'), 'stop-001');

    rerender(
      <ParcelAssignmentPanel
        key="route-002"
        parcels={[parcel]}
        stops={[{ ...stop, id: 'stop-002', routeId: 'route-002' }]}
        routeLabel="Route 2"
        onAssign={onAssign}
      />,
    );

    expect(screen.getByLabelText('Unassigned Parcel')).toHaveValue('');
    expect(screen.getByLabelText('Destination Stop')).toHaveValue('');
  });
});
