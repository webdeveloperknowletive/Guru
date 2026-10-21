'use client';
import { useStore } from '@/context/StoreContext';

export default function Toast() {
  const { toast } = useStore();

  return (
    <div className={`toast${toast.show ? ' show' : ''}`}>
      {toast.msg}
    </div>
  );
}
