"use client";

import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import type { Variants } from "motion/react";
import type { ComponentProps, ReactNode } from "react";
import { useEffect } from "react";

const gridVariants: Variants = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: "easeOut" },
  },
  hover: {
    y: -4,
    boxShadow: "0 16px 30px rgba(30, 67, 53, 0.10)",
    transition: { duration: 0.15, ease: "easeOut" },
  },
};

type MotionDivProps = ComponentProps<typeof motion.div>;

export function AnimatedGrid({ className, children, ...props }: MotionDivProps) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      {...props}
      className={className}
      variants={gridVariants}
      initial={reducedMotion ? { opacity: 1 } : "hidden"}
      animate={reducedMotion ? { opacity: 1 } : "visible"}
      transition={reducedMotion ? { duration: 0 } : undefined}
    >
      {children}
    </motion.div>
  );
}

export function AnimatedCard({
  className,
  children,
  standalone = false,
  ...props
}: MotionDivProps & { standalone?: boolean }) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      {...props}
      className={className}
      variants={cardVariants}
      initial={reducedMotion ? { opacity: 1 } : standalone ? "hidden" : undefined}
      animate={reducedMotion ? { opacity: 1 } : standalone ? "visible" : undefined}
      whileHover={reducedMotion ? undefined : "hover"}
      transition={reducedMotion ? { duration: 0 } : undefined}
    >
      {children}
    </motion.div>
  );
}

export function AnimatedList({ children }: { children: ReactNode }) {
  return <AnimatePresence mode="popLayout">{children}</AnimatePresence>;
}

export function AnimatedListItem({ children, className, ...props }: MotionDivProps) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      {...props}
      layout={!reducedMotion}
      className={className}
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, x: 8 }}
      animate={reducedMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
      exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: 8 }}
      transition={reducedMotion ? { duration: 0.15 } : { duration: 0.2, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

export function AnimatedView({ viewKey, children }: { viewKey: string; children: ReactNode }) {
  const reducedMotion = useReducedMotion();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={viewKey}
        initial={reducedMotion ? { opacity: 0 } : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reducedMotion ? 0.15 : 0.2, ease: "easeOut" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

export function AnimatedModal({
  open,
  children,
  className = "modal",
  onClose,
}: {
  open: boolean;
  children: ReactNode;
  className?: string;
  onClose: () => void;
}) {
  const reducedMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-backdrop"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0.15 : 0.2, ease: "easeOut" }}
        >
          <motion.div
            className={className}
            onClick={(event) => event.stopPropagation()}
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, x: 24 }}
            animate={reducedMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: 24 }}
            transition={reducedMotion ? { duration: 0.15 } : { type: "spring", stiffness: 320, damping: 28, mass: 0.5 }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

type CountUpFormat = "number" | "currency" | "percent";

function formatCount(value: number, format: CountUpFormat, currency: string, decimals: number, suffix: string) {
  const rounded = Number.isFinite(value) ? value : 0;
  if (format === "percent") return `${rounded.toFixed(decimals)}%${suffix}`;
  return `${new Intl.NumberFormat("en-IN", {
    style: format === "currency" ? "currency" : "decimal",
    currency: format === "currency" ? currency : undefined,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(rounded)}${suffix}`;
}

export function CountUp({
  value,
  format = "number",
  currency = "INR",
  decimals = 0,
  suffix = "",
  className,
}: {
  value: number;
  format?: CountUpFormat;
  currency?: string;
  decimals?: number;
  suffix?: string;
  className?: string;
}) {
  const reducedMotion = useReducedMotion();
  const valueMotion = useMotionValue(value);
  const springValue = useSpring(valueMotion, { stiffness: 90, damping: 20 });
  const displayValue = useTransform(springValue, (latest) => formatCount(latest, format, currency, decimals, suffix));

  useEffect(() => {
    valueMotion.set(value);
  }, [value, valueMotion]);

  if (reducedMotion) return <span className={className}>{formatCount(value, format, currency, decimals, suffix)}</span>;
  return <motion.span className={className}>{displayValue}</motion.span>;
}
