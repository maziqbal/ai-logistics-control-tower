import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ParcelCreationPanel } from './ParcelCreationPanel';

function fillForm() {
  fireEvent.change(screen.getByLabelText('Tracking Number'), {
    target: { value: 'PKG-HEL-0002' },
  });

  fireEvent.change(screen.getByLabelText('Destination'), {
    target: { value: 'Mannerheimintie 20, Helsinki' },
  });

  fireEvent.change(screen.getByLabelText('Location Key'), {
    target: { value: 'helsinki-location-002' },
  });

  fireEvent.change(screen.getByLabelText('Longitude'), {
    target: { value: '24.9384' },
  });

  fireEvent.change(screen.getByLabelText('Latitude'), {
    target: { value: '60.1699' },
  });
}

describe('ParcelCreationPanel', () => {
  it('creates a parcel with the expected payload', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);

    render(<ParcelCreationPanel onCreate={onCreate} />);

    fillForm();

    fireEvent.click(screen.getByRole('button', { name: 'Create Parcel' }));

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith({
        trackingNumber: 'PKG-HEL-0002',
        destination: 'Mannerheimintie 20, Helsinki',
        locationKey: 'helsinki-location-002',
        longitude: 24.9384,
        latitude: 60.1699,
      });
    });

    expect(await screen.findByText('Parcel created successfully.')).toBeInTheDocument();

    expect(screen.getByLabelText('Tracking Number')).toHaveValue('');
  });

  it('rejects invalid coordinates', async () => {
    const onCreate = vi.fn();

    render(<ParcelCreationPanel onCreate={onCreate} />);

    fillForm();

    fireEvent.change(screen.getByLabelText('Latitude'), {
      target: { value: '95' },
    });

    fireEvent.submit(screen.getByRole('button', { name: 'Create Parcel' }).closest('form')!);

    expect(onCreate).not.toHaveBeenCalled();

    expect(
      await screen.findByText('Please enter valid longitude and latitude coordinates.'),
    ).toBeInTheDocument();
  });

  it('displays API errors without clearing the form', async () => {
    const onCreate = vi.fn().mockRejectedValue(new Error('Parcel creation failed (409)'));

    render(<ParcelCreationPanel onCreate={onCreate} />);

    fillForm();

    fireEvent.click(screen.getByRole('button', { name: 'Create Parcel' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Parcel creation failed (409)');

    expect(screen.getByLabelText('Tracking Number')).toHaveValue('PKG-HEL-0002');
  });

  it('disables form submission when delivery data is unavailable', () => {
    const onCreate = vi.fn();

    render(<ParcelCreationPanel onCreate={onCreate} disabled />);

    expect(screen.getByRole('button', { name: 'Create Parcel' })).toBeDisabled();

    expect(screen.getByLabelText('Tracking Number')).toBeDisabled();

    expect(onCreate).not.toHaveBeenCalled();
  });

  it('prevents duplicate submission while creating a parcel', async () => {
    let resolveCreate!: () => void;

    const onCreate = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveCreate = resolve;
        }),
    );

    render(<ParcelCreationPanel onCreate={onCreate} />);

    fillForm();

    fireEvent.click(screen.getByRole('button', { name: 'Create Parcel' }));

    expect(await screen.findByRole('button', { name: 'Creating Parcel...' })).toBeDisabled();

    expect(onCreate).toHaveBeenCalledTimes(1);

    resolveCreate();

    expect(await screen.findByText('Parcel created successfully.')).toBeInTheDocument();
  });
});
