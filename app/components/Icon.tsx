"use client";

import {
  TrainSimpleIcon,
  TreeIcon,
  BuildingsIcon,
  MapTrifoldIcon,
  ShieldStarIcon,
  HeartbeatIcon,
  GraduationCapIcon,
  DropIcon,
  StorefrontIcon,
  BusIcon,
  BicycleIcon,
  MapPinIcon,
  ParkIcon,
  HospitalIcon,
  ForkKnifeIcon,
  WifiHighIcon,
  BankIcon,
  LightningIcon,
  CompassIcon,
  type IconProps,
  type Icon as PhosphorIcon,
} from "@phosphor-icons/react";

const ICONS: Record<string, PhosphorIcon> = {
  TrainSimple: TrainSimpleIcon,
  Tree: TreeIcon,
  Buildings: BuildingsIcon,
  MapTrifold: MapTrifoldIcon,
  MapPinArea: MapPinIcon,
  MapPin: MapPinIcon,
  ShieldStar: ShieldStarIcon,
  Heartbeat: HeartbeatIcon,
  GraduationCap: GraduationCapIcon,
  Drop: DropIcon,
  Storefront: StorefrontIcon,
  Bus: BusIcon,
  Bicycle: BicycleIcon,
  BicycleIcon: LightningIcon,
  Park: ParkIcon,
  Hospital: HospitalIcon,
  ForkKnife: ForkKnifeIcon,
  WifiHigh: WifiHighIcon,
  Bank: BankIcon,
  Lightning: LightningIcon,
};

export function Icon({
  name,
  ...props
}: { name: string } & IconProps) {
  const C = ICONS[name] ?? CompassIcon;
  return <C {...props} />;
}
