"use client";

import { useMemo } from "react";
import { Line, Html } from "@react-three/drei";
import * as THREE from "three";

const MEASUREMENT_COLOR = "#000000";
const LINE_WIDTH = 2;
const LABEL_OFFSET_SCALE = 0.35;
const ARROW_SIZE = 0.2;
const ARROW_LENGTH = 0.1;

/** Renders a black measurement line with arrowheads at both ends and a label at the midpoint (offset outward). */
export function MeasurementArrow({
	start,
	end,
	label,
	labelOffsetDirection = [0, 1, 0],
	labelY,
}: {
	start: [number, number, number];
	end: [number, number, number];
	label: string;
	/** Unit vector outward from building for label offset; default (0,1,0) = above */
	labelOffsetDirection?: [number, number, number];
	/** If set, label is placed at this Y (world); otherwise use midpoint Y + offset */
	labelY?: number;
}) {
	const midpoint = useMemo(() => {
		return [
			(start[0] + end[0]) / 2,
			(start[1] + end[1]) / 2,
			(start[2] + end[2]) / 2,
		] as [number, number, number];
	}, [start, end]);

	const direction = useMemo(() => {
		const dx = end[0] - start[0];
		const dy = end[1] - start[1];
		const dz = end[2] - start[2];
		const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
		if (len === 0) return { x: 0, y: 0, z: 0, len: 0 };
		return { x: dx / len, y: dy / len, z: dz / len, len };
	}, [start, end]);

	const labelPosition = useMemo(() => {
		const [ox, oy, oz] = labelOffsetDirection;
		const s = LABEL_OFFSET_SCALE;
		const y = labelY !== undefined ? labelY : midpoint[1] + oy * s;
		return [
			midpoint[0] + ox * s,
			y,
			midpoint[2] + oz * s,
		] as [number, number, number];
	}, [midpoint, labelOffsetDirection, labelY]);

	const arrow1Points = useMemo(() => {
		if (direction.len === 0) return null;
		const dir = new THREE.Vector3(direction.x, direction.y, direction.z);
		const up = Math.abs(direction.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
		const right = new THREE.Vector3().crossVectors(dir, up).normalize();
		const arrowTip = new THREE.Vector3(...start);
		const arrowBase1 = arrowTip.clone().add(dir.clone().multiplyScalar(ARROW_SIZE)).add(right.clone().multiplyScalar(ARROW_LENGTH));
		const arrowBase2 = arrowTip.clone().add(dir.clone().multiplyScalar(ARROW_SIZE)).sub(right.clone().multiplyScalar(ARROW_LENGTH));
		return [
			[arrowTip.x, arrowTip.y, arrowTip.z],
			[arrowBase1.x, arrowBase1.y, arrowBase1.z],
			[arrowTip.x, arrowTip.y, arrowTip.z],
			[arrowBase2.x, arrowBase2.y, arrowBase2.z],
		] as [number, number, number][];
	}, [start, direction]);

	const arrow2Points = useMemo(() => {
		if (direction.len === 0) return null;
		const dir = new THREE.Vector3(direction.x, direction.y, direction.z);
		const up = Math.abs(direction.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
		const right = new THREE.Vector3().crossVectors(dir, up).normalize();
		const arrowTip = new THREE.Vector3(...end);
		const arrowBase1 = arrowTip.clone().sub(dir.clone().multiplyScalar(ARROW_SIZE)).add(right.clone().multiplyScalar(ARROW_LENGTH));
		const arrowBase2 = arrowTip.clone().sub(dir.clone().multiplyScalar(ARROW_SIZE)).sub(right.clone().multiplyScalar(ARROW_LENGTH));
		return [
			[arrowTip.x, arrowTip.y, arrowTip.z],
			[arrowBase1.x, arrowBase1.y, arrowBase1.z],
			[arrowTip.x, arrowTip.y, arrowTip.z],
			[arrowBase2.x, arrowBase2.y, arrowBase2.z],
		] as [number, number, number][];
	}, [end, direction]);

	return (
		<>
			<Line points={[start, end]} color={MEASUREMENT_COLOR} lineWidth={LINE_WIDTH} />
			{arrow1Points && <Line points={arrow1Points} color={MEASUREMENT_COLOR} lineWidth={LINE_WIDTH} />}
			{arrow2Points && <Line points={arrow2Points} color={MEASUREMENT_COLOR} lineWidth={LINE_WIDTH} />}
			<Html position={labelPosition} center>
				<span className="text-black text-[9px] font-medium whitespace-nowrap">
					{label}
				</span>
			</Html>
		</>
	);
}
