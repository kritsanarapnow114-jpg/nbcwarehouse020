"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/lib/actions/auth";

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    loginAction,
    {}
  );

  return (
    <form action={formAction} className="flex flex-col gap-3.5">
      <input type="hidden" name="next" value={next} />
      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-medium text-[#3a4658]">
          Email (อีเมล)
        </span>
        <input
          name="email"
          type="email"
          required
          autoFocus
          defaultValue="somchai@nbcwarehouse.test"
          className="rounded-[8px] border border-[#d7dce4] px-3 py-2.5 text-[13px] outline-none focus:border-[#3E9B6E]"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-medium text-[#3a4658]">
          Password (รหัสผ่าน)
        </span>
        <input
          name="password"
          type="password"
          required
          defaultValue="warehouse123"
          className="rounded-[8px] border border-[#d7dce4] px-3 py-2.5 text-[13px] outline-none focus:border-[#3E9B6E]"
        />
      </label>
      {state.error && (
        <div className="rounded-[8px] bg-[#fbe9e9] px-3 py-2 text-[12.5px] text-[#c53f3f]">
          {state.error}
        </div>
      )}
      <button
        type="submit"
        disabled={pending}
        className="mt-1.5 rounded-[9px] bg-[#3E9B6E] px-4 py-2.5 text-[13.5px] font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Signing in… (กำลังเข้าสู่ระบบ)" : "Sign in (เข้าสู่ระบบ)"}
      </button>
      <div className="mt-1 text-center text-[11px] text-[#9aa4b4]">
        Seeded user: somchai@nbcwarehouse.test / warehouse123
      </div>
    </form>
  );
}
