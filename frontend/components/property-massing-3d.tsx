"use client";

import React, { Suspense, ErrorInfo, ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html, Line } from "@react-three/drei";

/**
 * Error Boundary for 3D component - catches any errors and prevents them from crashing the report page
 */
class MassingErrorBoundary extends React.Component<
	{ children: ReactNode },
	{ hasError: boolean }
> {
	constructor(props: { children: ReactNode }) {
		super(props);
		this.state = { hasError: false };
	}

	static getDerivedStateFromError() {
		return { hasError: true };
	}

	componentDidCatch(error: Error, errorInfo: ErrorInfo) {
		console.error("PropertyMassing3D error:", error, errorInfo);
	}

	render() {
		if (this.state.hasError) {
			// Return null to hide the component if it crashes
			// Alternatively, return a simple fallback:
			// return <div className="text-sm text-[#605A57]">3D View Unavailable</div>;
			return null;
		}

		return this.props.children;
	}
}

/**
 * Props for PropertyMassing3D component
 */
interface PropertyMassing3DProps {
	lotAreaSqft: number | null;
	lotFrontageFt: number | null;
	minBaseHeightFt: number | null;
	maxBaseHeightFt: number | null;
	maxBuildingHeightFt: number | null;
	/** Address label shown at the front (street side) of the lot */
	address?: string | null;
}

/**
 * Helper to parse lot area from string like "5,000 sq ft" to number
 */
function parseLotArea(lotAreaStr: string | null | undefined): number | null {
	if (!lotAreaStr) return null;
	const match = lotAreaStr.replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
	return match ? parseFloat(match[1]) : null;
}

/**
 * Helper to parse frontage from string like "25 ft" to number
 */
function parseLotFrontage(frontageStr: string | null | undefined): number | null {
	if (!frontageStr) return null;
	const match = frontageStr.replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
	return match ? parseFloat(match[1]) : null;
}

/**
 * Calculate lot depth from area and frontage
 */
function calculateLotDepth(
	lotAreaSqft: number | null,
	lotFrontageFt: number | null
): number | null {
	if (!lotAreaSqft || !lotFrontageFt || lotFrontageFt === 0) return null;
	return lotAreaSqft / lotFrontageFt;
}

/**
 * 3D Scene Component - renders the massing visualization
 */
function MassingScene({
	lotAreaSqft,
	lotFrontageFt,
	minBaseHeightFt,
	maxBaseHeightFt,
	maxBuildingHeightFt,
	address,
}: PropertyMassing3DProps) {
	const lotDepthFt = calculateLotDepth(lotAreaSqft, lotFrontageFt);

	// Validate we have minimum required data
	if (!lotFrontageFt || !lotDepthFt || !maxBaseHeightFt) {
		return null;
	}

	// Scale factor: convert feet to Three.js units (1 unit = 1 foot, but we'll scale for visibility)
	// For better visualization, we can use a scale where 1 unit = 10 feet
	const scale = 0.1; // 1 Three.js unit = 10 feet
	const frontage = lotFrontageFt * scale;
	const depth = lotDepthFt * scale;
	const baseHeight = maxBaseHeightFt * scale;
	const buildingHeight = maxBuildingHeightFt ? maxBuildingHeightFt * scale : baseHeight;
	const towerHeight = buildingHeight - baseHeight;

	// Center the lot at origin
	const centerX = 0;
	const centerZ = 0;

	return (
		<>
			{/* Lighting */}
			<ambientLight intensity={0.6} />
			<directionalLight position={[10, 10, 5]} intensity={0.8} />
			<directionalLight position={[-10, 5, -5]} intensity={0.4} />

			{/* Ground plane (lot) */}
			<mesh rotation={[-Math.PI / 2, 0, 0]} position={[centerX, 0, centerZ]}>
				<planeGeometry args={[Math.max(frontage, depth) * 2, Math.max(frontage, depth) * 2]} />
				<meshStandardMaterial color="#E5E7EB" />
			</mesh>

			{/* "Lot" label flat on the gray ground */}
			<Html position={[centerX, 0.15, centerZ]} center transform>
				<div className="bg-[#E5E7EB]/95 rounded px-2 py-1 text-xs font-semibold text-[#605A57] border border-[rgba(55,50,47,0.15)] shadow-sm whitespace-nowrap">
					Lot
				</div>
			</Html>

			{/* Address at front of lot (street side, -Z face) */}
			{address != null && String(address).trim() !== "" && (
				<Html position={[centerX, baseHeight * 0.4, centerZ - depth / 2 - 0.3]} center>
					<div className="bg-white/95 rounded px-2 py-1.5 text-xs font-medium text-[#37322F] border-2 border-[#37322F] shadow-md max-w-[200px] text-center">
						{String(address).trim()}
					</div>
				</Html>
			)}

			{/* Base massing (solid box) */}
			<mesh position={[centerX, baseHeight / 2, centerZ]}>
				<boxGeometry args={[frontage, baseHeight, depth]} />
				<meshStandardMaterial color="#4090C2" opacity={0.8} transparent />
			</mesh>

			{/* Potential building extension (wireframe box) - only if tower height > 0 */}
			{towerHeight > 0 && (
				<mesh position={[centerX, baseHeight + towerHeight / 2, centerZ]}>
					<boxGeometry args={[frontage, towerHeight, depth]} />
					<meshStandardMaterial
						color="#60A5FA"
						wireframe
						opacity={0.6}
						transparent
					/>
				</mesh>
			)}

			{/* Depth dimension line: front-to-back of lot (along Z) on top of base */}
			<Line
				points={[
					[centerX, baseHeight + 0.2, centerZ - depth / 2],
					[centerX, baseHeight + 0.2, centerZ + depth / 2],
				]}
				color="#37322F"
				lineWidth={2}
			/>

			{/* HTML Labels for dimensions */}
			<Html position={[centerX, baseHeight + 2, centerZ]} center>
				<div className="bg-white/90 backdrop-blur-sm rounded px-2 py-1 text-xs text-[#37322F] border border-[rgba(55,50,47,0.12)] shadow-sm">
					<div>Base: {maxBaseHeightFt.toFixed(0)} ft</div>
					{maxBuildingHeightFt && maxBuildingHeightFt > maxBaseHeightFt && (
						<div>Max: {maxBuildingHeightFt.toFixed(0)} ft</div>
					)}
				</div>
			</Html>

			<Html position={[frontage / 2 + 1, baseHeight / 2, centerZ]} center>
				<div className="bg-white/90 backdrop-blur-sm rounded px-2 py-1 text-xs text-[#37322F] border border-[rgba(55,50,47,0.12)] shadow-sm whitespace-nowrap">
					Frontage: {lotFrontageFt.toFixed(0)} ft
				</div>
			</Html>

			<Html position={[centerX, baseHeight / 2, depth / 2 + 1]} center>
				<div className="bg-white/95 backdrop-blur-sm rounded px-2 py-1.5 text-xs text-[#37322F] border-2 border-[#37322F] shadow-md max-w-[180px]">
					<div className="font-semibold">Depth: {lotDepthFt.toFixed(0)} ft</div>
					<div className="text-[11px] text-[#605A57] mt-1 leading-tight">Front to back of lot (perpendicular to street)</div>
				</div>
			</Html>

			{/* Camera controls */}
			<OrbitControls
				enablePan={true}
				enableZoom={true}
				enableRotate={true}
				minDistance={Math.max(frontage, depth) * 1.5}
				maxDistance={Math.max(frontage, depth) * 5}
				target={[centerX, baseHeight / 2, centerZ]}
			/>
		</>
	);
}

/**
 * Main PropertyMassing3D Component
 * Wrapped in Error Boundary for non-blocking behavior
 */
export default function PropertyMassing3D({
	lotAreaSqft,
	lotFrontageFt,
	minBaseHeightFt,
	maxBaseHeightFt,
	maxBuildingHeightFt,
	address,
}: PropertyMassing3DProps) {
	// Validate required props
	if (!lotAreaSqft || !lotFrontageFt || !maxBaseHeightFt) {
		return null;
	}

	return (
		<MassingErrorBoundary>
			<div className="w-full h-[400px] rounded-lg overflow-hidden border border-[rgba(55,50,47,0.12)] bg-[#F9F8F6]">
				<Suspense fallback={<div className="w-full h-full flex items-center justify-center text-sm text-[#605A57]">Loading 3D view...</div>}>
					<Canvas
						camera={{ position: [3, 6, -18], fov: 50 }}
						gl={{ antialias: true }}
					>
						<MassingScene
							lotAreaSqft={lotAreaSqft}
							lotFrontageFt={lotFrontageFt}
							minBaseHeightFt={minBaseHeightFt}
							maxBaseHeightFt={maxBaseHeightFt}
							maxBuildingHeightFt={maxBuildingHeightFt}
							address={address}
						/>
					</Canvas>
				</Suspense>
			</div>
		</MassingErrorBoundary>
	);
}
