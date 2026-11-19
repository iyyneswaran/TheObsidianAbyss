import { useEffect, useRef } from "react";

export function PartyConfirm({
  title,
  detail,
  confirm,
  onCancel,
  onConfirm,
}: {
  title: string;
  detail: string;
  confirm: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-labelledby="party-confirm-title"
      onCancel={onCancel}
      className="m-auto w-[min(30rem,calc(100%-2rem))] rounded-xl border border-gold/60 bg-panel p-6 text-slate-100 backdrop:bg-black/75"
    >
      <h2 id="party-confirm-title" className="font-serif text-3xl">
        {title}
      </h2>
      <p className="my-5 text-sm leading-relaxed text-slate-300">{detail}</p>
      <div className="flex flex-wrap justify-end gap-2">
        <button className="action" onClick={onCancel} autoFocus>
          Cancel
        </button>
        <button className="action" onClick={onConfirm}>
          {confirm}
        </button>
      </div>
    </dialog>
  );
}
