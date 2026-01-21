"use client";

export function ConfirmSubmitButton({
  children,
  message,
}: {
  children: React.ReactNode;
  message: string;
}) {
  return (
    <button
      type="submit"
      style={{ padding: "6px 10px", cursor: "pointer" }}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
