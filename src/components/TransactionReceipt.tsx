import { forwardRef } from 'react';
import { format } from 'date-fns';
import { formatETB } from '@/lib/currency';
import esmacLogo from '@/assets/esmac-logo.png';

interface ReceiptProps {
  transaction: {
    id: string;
    customer_name: string;
    customer_phone?: string | null;
    services?: { service_name: string } | null;
    quantity: number;
    unit_price: number;
    total_price: number;
    payment_method: string;
    status: string;
    created_at: string;
    notes?: string | null;
  };
}

export const TransactionReceipt = forwardRef<HTMLDivElement, ReceiptProps>(({ transaction }, ref) => {
  return (
    <div ref={ref} className="bg-white text-gray-900 p-8 max-w-[210mm] mx-auto" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div className="text-center border-b-2 border-gray-800 pb-4 mb-6">
        <img src={esmacLogo} alt="ESMAC" className="w-16 h-16 mx-auto mb-2 object-contain" />
        <h1 className="text-xl font-bold tracking-wide" style={{ color: '#1a3a5c' }}>ESMAC Service Manager</h1>
        <p className="text-xs text-gray-500 mt-1">Your Partner in Engineering Services and Management Affairs</p>
      </div>

      {/* Receipt title */}
      <div className="text-center mb-6">
        <h2 className="text-lg font-bold uppercase tracking-widest" style={{ color: '#b5541a' }}>Receipt</h2>
        <p className="text-xs text-gray-500 mt-1">#{transaction.id.slice(0, 8).toUpperCase()}</p>
      </div>

      {/* Details */}
      <div className="space-y-3 text-sm mb-6">
        <div className="flex justify-between">
          <span className="text-gray-500">Date:</span>
          <span className="font-medium">{format(new Date(transaction.created_at), 'MMMM d, yyyy HH:mm')}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Customer:</span>
          <span className="font-medium">{transaction.customer_name}</span>
        </div>
        {transaction.customer_phone && (
          <div className="flex justify-between">
            <span className="text-gray-500">Phone:</span>
            <span>{transaction.customer_phone}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-gray-500">Service:</span>
          <span className="font-medium">{transaction.services?.service_name || '—'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Payment:</span>
          <span>{transaction.payment_method}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Status:</span>
          <span className="font-medium capitalize">{transaction.status === 'completed' ? 'Paid' : transaction.status}</span>
        </div>
      </div>

      {/* Price breakdown */}
      <div className="border-t border-b border-gray-300 py-3 space-y-2 text-sm mb-6">
        <div className="flex justify-between">
          <span>Quantity</span>
          <span>{transaction.quantity}</span>
        </div>
        <div className="flex justify-between">
          <span>Unit Price</span>
          <span>{formatETB(Number(transaction.unit_price))}</span>
        </div>
        <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-200" style={{ color: '#1a3a5c' }}>
          <span>Total</span>
          <span>{formatETB(Number(transaction.total_price))}</span>
        </div>
      </div>

      {transaction.notes && (
        <div className="text-xs text-gray-500 mb-4">
          <span className="font-medium">Notes:</span> {transaction.notes}
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-xs text-gray-400 mt-8 pt-4 border-t border-gray-200">
        <p>Thank you for your business!</p>
        <p className="mt-1">Prepared by Abdikeni Hussein Hirsi</p>
        <p>© {new Date().getFullYear()} ESMAC Consultant</p>
      </div>
    </div>
  );
});

TransactionReceipt.displayName = 'TransactionReceipt';
