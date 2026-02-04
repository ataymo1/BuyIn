"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type NotificationType = "success" | "error" | "info" | "warning";

interface NotificationState {
  isOpen: boolean;
  title: string;
  message: string;
  type: NotificationType;
}

interface NotificationContextType {
  showNotification: (message: string, options?: { title?: string; type?: NotificationType }) => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notification, setNotification] = useState<NotificationState>({
    isOpen: false,
    title: "",
    message: "",
    type: "info",
  });

  const showNotification = useCallback(
    (message: string, options?: { title?: string; type?: NotificationType }) => {
      const type = options?.type ?? "info";
      const defaultTitles: Record<NotificationType, string> = {
        success: "Success",
        error: "Error",
        info: "Notice",
        warning: "Warning",
      };
      setNotification({
        isOpen: true,
        title: options?.title ?? defaultTitles[type],
        message,
        type,
      });
    },
    []
  );

  const handleClose = () => {
    setNotification((prev) => ({ ...prev, isOpen: false }));
  };

  const getTypeStyles = (type: NotificationType) => {
    switch (type) {
      case "success":
        return "text-green-600";
      case "error":
        return "text-red-600";
      case "warning":
        return "text-amber-600";
      default:
        return "";
    }
  };

  return (
    <NotificationContext.Provider value={{ showNotification }}>
      {children}
      <AlertDialog open={notification.isOpen} onOpenChange={handleClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className={getTypeStyles(notification.type)}>
              {notification.title}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-foreground/80">
              {notification.message}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleClose}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotification must be used within a NotificationProvider");
  }
  return context;
}
