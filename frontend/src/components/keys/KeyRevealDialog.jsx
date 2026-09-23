import React, { useState } from 'react';
import { Copy, Check, AlertTriangle, Key } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { toast } from 'sonner';
import { copyToClipboard } from '../../lib/utils';

export const KeyRevealDialog = ({ fullKey, keyName, onClose }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!fullKey) return;
    const success = await copyToClipboard(fullKey);
    if (success) {
      setCopied(true);
      toast.success('API key copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error('Failed to copy API key');
    }
  };


  return (
    <Modal isOpen={true} onClose={onClose} title="API Key Generated" maxWidth="lg">
      <div className="space-y-4 text-left">
        {/* Security Alert Banner */}
        <div className="px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2.5">
          <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong className="text-amber-900 font-bold">Important Security Notice:</strong> Please copy and safely store this API secret key now. For your security, it will <strong>never be shown again</strong>. Only the prefix is preserved in the database.
          </div>
        </div>

        {/* Key Display & Copy */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-[#292929] font-mono">
            Key: <span className="text-gray-600 font-normal">{keyName}</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={fullKey}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-[#292929] font-mono text-xs font-semibold focus:outline-none select-all"
            />
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={handleCopy}
              className="flex items-center gap-1.5 shrink-0"
            >
              {copied ? <Check size={14} className="text-[#292929]" /> : <Copy size={14} />}
              <span>{copied ? 'Copied' : 'Copy Key'}</span>
            </Button>
          </div>
        </div>

        {/* Close confirmation */}
        <div className="pt-4 border-t border-gray-100 flex justify-end">
          <Button variant="dark" onClick={onClose}>
            I Have Stored This Key Safely →
          </Button>
        </div>
      </div>
    </Modal>
  );
};
