"use client";

import { useState } from "react";

/** Demo state for the showcase. No IO: every control just updates local state. */
export function useDesignSystemViewModel() {
  const [checked, setChecked] = useState(false);
  const [rowDone, setRowDone] = useState(false);
  const [segment, setSegment] = useState<"shopping" | "chores">("shopping");
  const [pill, setPill] = useState("all");
  const [otp, setOtp] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [text, setText] = useState("");

  return {
    checked,
    onCheckedChange: setChecked,
    rowDone,
    onRowDoneChange: setRowDone,
    segment,
    onSegmentChange: setSegment,
    pill,
    onPillChange: setPill,
    otp,
    onOtpChange: setOtp,
    otpInvalid: otp === "000000",
    sheetOpen,
    onSheetOpenChange: setSheetOpen,
    text,
    onTextChange: setText,
  };
}
