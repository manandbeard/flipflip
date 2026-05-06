/**
 * PaywallModal — displayed when the player attempts to progress past Level 1
 * without an active subscription.
 *
 * Built with @radix-ui/react-dialog primitives styled to match shadcn/ui conventions.
 * Closing the modal resumes the Phaser scene via EventBus.
 */

import * as Dialog from '@radix-ui/react-dialog';
import { useGameStore } from '@/shared/store/useGameStore';
import { EventBus } from '@/shared/utils/EventBus';

export function PaywallModal() {
  const isOpen = useGameStore((s) => s.isPaywallOpen);
  const closePaywall = useGameStore((s) => s.closePaywall);
  const setPhase = useGameStore((s) => s.setPhase);

  function handleClose() {
    closePaywall();
    setPhase('playing');
    EventBus.emit('scene-resume');
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <Dialog.Portal>
        {/* Backdrop */}
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        {/* Panel */}
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/10 bg-gray-900 p-8 shadow-2xl focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
          {/* Icon */}
          <div className="mb-6 flex justify-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-yellow-500/20 text-4xl">
              🔒
            </span>
          </div>

          <Dialog.Title className="mb-2 text-center text-2xl font-bold text-white">
            Unlock Full Adventure
          </Dialog.Title>

          <Dialog.Description className="mb-6 text-center text-sm text-gray-400">
            You've reached the end of the free tier. Subscribe to continue your
            journey past Level&nbsp;1 and unlock all worlds, NPCs, and story
            content.
          </Dialog.Description>

          {/* CTA */}
          <div className="flex flex-col gap-3">
            <a
              href="#subscribe"
              className="inline-flex w-full items-center justify-center rounded-lg bg-yellow-500 px-6 py-3 text-sm font-semibold text-gray-900 transition-colors hover:bg-yellow-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-500"
              onClick={handleClose}
            >
              Subscribe Now
            </a>
            <button
              type="button"
              onClick={handleClose}
              className="w-full rounded-lg border border-white/10 px-6 py-3 text-sm font-medium text-gray-300 transition-colors hover:border-white/30 hover:text-white"
            >
              Return to Level 1
            </button>
          </div>

          {/* Close button (×) */}
          <Dialog.Close
            onClick={handleClose}
            className="absolute right-4 top-4 rounded-sm text-gray-400 opacity-70 ring-offset-gray-900 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2"
            aria-label="Close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
