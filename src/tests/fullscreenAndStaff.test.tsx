// @vitest-environment jsdom
import { act, render, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StaffCanvas } from '../components/StaffCanvas';
import { useFullscreen } from '../hooks/useFullscreen';

describe('useFullscreen horizontal orientation behavior', () => {
  const originalRequestFullscreen = document.documentElement.requestFullscreen;
  const originalExitFullscreen = document.exitFullscreen;
  const originalScreenOrientation = window.screen.orientation;

  afterEach(() => {
    Object.defineProperty(document.documentElement, 'requestFullscreen', {
      configurable: true,
      value: originalRequestFullscreen,
    });
    Object.defineProperty(document, 'exitFullscreen', {
      configurable: true,
      value: originalExitFullscreen,
    });
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      value: null,
    });
    Object.defineProperty(window.screen, 'orientation', {
      configurable: true,
      value: originalScreenOrientation,
    });
    vi.restoreAllMocks();
  });

  it('locks landscape orientation on enterFullscreen and unlocks on exitFullscreen', async () => {
    const lockMock = vi.fn().mockResolvedValue(undefined);
    const unlockMock = vi.fn();

    Object.defineProperty(window.screen, 'orientation', {
      configurable: true,
      value: { lock: lockMock, unlock: unlockMock },
    });
    Object.defineProperty(document.documentElement, 'requestFullscreen', {
      configurable: true,
      value: vi.fn().mockImplementation(async () => {
        Object.defineProperty(document, 'fullscreenElement', {
          configurable: true,
          value: document.documentElement,
        });
        document.dispatchEvent(new Event('fullscreenchange'));
      }),
    });
    Object.defineProperty(document, 'exitFullscreen', {
      configurable: true,
      value: vi.fn().mockImplementation(async () => {
        Object.defineProperty(document, 'fullscreenElement', {
          configurable: true,
          value: null,
        });
        document.dispatchEvent(new Event('fullscreenchange'));
      }),
    });

    const { result } = renderHook(() => useFullscreen());
    expect(result.current.isSupported).toBe(true);

    await act(async () => {
      await result.current.enterFullscreen();
    });

    expect(lockMock).toHaveBeenCalledWith('landscape');
    expect(result.current.isFullscreen).toBe(true);

    await act(async () => {
      await result.current.exitFullscreen();
    });

    expect(unlockMock).toHaveBeenCalled();
    expect(result.current.isFullscreen).toBe(false);
  });

  it('handles unsupported or rejected screen.orientation.lock cleanly', async () => {
    const lockMock = vi.fn().mockRejectedValue(new Error('NotSupportedError'));
    Object.defineProperty(window.screen, 'orientation', {
      configurable: true,
      value: { lock: lockMock },
    });
    Object.defineProperty(document.documentElement, 'requestFullscreen', {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });

    const { result } = renderHook(() => useFullscreen());
    await expect(
      act(async () => {
        await result.current.enterFullscreen();
      })
    ).resolves.not.toThrow();
    expect(lockMock).toHaveBeenCalledWith('landscape');
  });
});

describe('StaffCanvas sizing', () => {
  it('tightens vertical viewBox to noteTargets so staff and notes scale larger', () => {
    const { container, rerender } = render(
      <StaffCanvas
        clefMode="grand"
        activeNote={{ note: 'C4', staff: 'treble' }}
        theme="classic"
        showLandmarks
      />
    );

    let svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('viewBox')).toBe('0 0 680 336');
    expect(svg?.getAttribute('class')).not.toContain('max-w-4xl');

    rerender(
      <StaffCanvas
        clefMode="grand"
        activeNote={{ note: 'D4', staff: 'treble' }}
        noteTargets={[
          { note: 'C3', staff: 'bass' },
          { note: 'C5', staff: 'treble' },
        ]}
        theme="classic"
        showLandmarks
      />
    );

    svg = container.querySelector('svg');
    expect(svg?.getAttribute('viewBox')).toBe('0 0 680 260');

    rerender(
      <StaffCanvas
        clefMode="treble"
        activeNote={{ note: 'G4', staff: 'treble' }}
        noteTargets={[{ note: 'E4' }, { note: 'F5' }]}
        theme="classic"
        showLandmarks={false}
      />
    );

    svg = container.querySelector('svg');
    expect(svg?.getAttribute('viewBox')).toBe('0 0 680 136');
  });
});
