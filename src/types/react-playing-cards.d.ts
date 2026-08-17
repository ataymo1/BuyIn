declare module "@heruka_urgyen/react-playing-cards/lib/FcB" {
  import type { CSSProperties } from "react";

  interface CardProps {
    back?: boolean;
    card?: string;
    className?: string;
    front?: boolean;
    height?: string;
    style?: CSSProperties;
  }

  export default function Card(props: CardProps): React.JSX.Element | null;
}
