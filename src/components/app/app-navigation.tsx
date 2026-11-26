"use client";

import { createContext, useContext, type ComponentProps } from "react";
import { getAppHref, type AppDestination } from "@/lib/water-sort/navigation/app-location";

export const AppNavigation = createContext<
  ((destination: AppDestination, replace: boolean) => void) | null
>(null);

export function useAppNavigation() {
  const navigate = useContext(AppNavigation);
  if (navigate === null) throw new Error("Navigation requires the application shell.");
  return navigate;
}

type AppLinkProps = Omit<ComponentProps<"a">, "href" | "onClick"> & {
  destination: AppDestination;
  replace?: boolean;
};

export function AppLink({ destination, replace = false, ...props }: AppLinkProps) {
  const navigate = useAppNavigation();

  return (
    <a
      {...props}
      href={getAppHref(destination, process.env.NEXT_PUBLIC_BASE_PATH ?? "")}
      onClick={(event) => {
        if (
          event.defaultPrevented || event.button !== 0 ||
          event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
          (props.target !== undefined && props.target !== "_self") ||
          props.download !== undefined
        ) return;
        event.preventDefault();
        navigate(destination, replace);
      }}
    />
  );
}
