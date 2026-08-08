declare module 'tailwind-merge' {
  export function twMerge(...classes: string[]): string;
}

declare module 'class-variance-authority' {
  import { type ClassValue } from 'clsx';
  
  type VariantProps<T> = Record<string, any>;
  
  export function cva(
    base: string,
    config?: {
      variants?: Record<string, Record<string, string>>;
      defaultVariants?: Record<string, string>;
    }
  ): (props?: Record<string, any>) => string;
}