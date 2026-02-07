"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MassingSandboxScene } from "@/app/(workspace)/massing-sandbox/page";
import { getReportMassing, patchReportMassing, type MassingOverrides } from "@/lib/reports";
import { toast } from "sonner";
import { Box } from "lucide-react";

/** Same hardcoded defaults as massing-sandbox (no dependency on page export) */
const MASSING_DEFAULTS = {
	lotLengthFt: 100,
	lotWidthFt: 25,
	scale: 0.1,
	groundColor: "#E5E7EB",
	lotSlabHeightFt: 2,
	lotSlabPaddingFt: 2,
	ambientLightIntensity: 0.6,
	directionalLightIntensity: 0.8,
	cameraPosX: -5,
	cameraPosY: 6,
	cameraPosZ: -10,
	frontWallFt: 20,
	backWallFt: 20,
	leftWallFt: 80,
	rightWallFt: 80,
	baseHeightFt: 20,
	buildingHeightFt: 37,
	setbackStartFt: 18,
	frontSetbackFt: 20,
	maxHeightFt: 50,
	showMaxHeightCage: false,
	xAlign: "center" as const,
	zAlign: "center" as const,
};

const HEIGHT_PX = 400;
const SCALE = MASSING_DEFAULTS.scale;

function parseNum(value: string, fallback: number): number {
	const n = parseFloat(value);
	return Number.isFinite(n) ? n : fallback;
}

function overridesToFormState(o: MassingOverrides | null) {
	const d = MASSING_DEFAULTS;
	return {
		lotLengthFt: String(o?.lotLengthFt ?? d.lotLengthFt),
		lotWidthFt: String(o?.lotWidthFt ?? d.lotWidthFt),
		frontWallFt: String(o?.frontWallFt ?? d.frontWallFt),
		backWallFt: String(o?.backWallFt ?? d.backWallFt),
		leftWallFt: String(o?.leftWallFt ?? d.leftWallFt),
		rightWallFt: String(o?.rightWallFt ?? d.rightWallFt),
		baseHeightFt: String(o?.baseHeightFt ?? d.baseHeightFt),
		buildingHeightFt: String(o?.buildingHeightFt ?? d.buildingHeightFt),
		setbackStartFt: String(o?.setbackStartFt ?? d.setbackStartFt),
		frontSetbackFt: String(o?.frontSetbackFt ?? d.frontSetbackFt),
		maxHeightFt: String(o?.maxHeightFt ?? d.maxHeightFt),
		showMaxHeightCage: o?.showMaxHeightCage ?? d.showMaxHeightCage,
		xAlign: (o?.xAlign ?? d.xAlign) as "left" | "center" | "right",
		zAlign: (o?.zAlign ?? d.zAlign) as "front" | "center" | "back",
		inputsPanelHidden: o?.inputsPanelHidden ?? false,
	};
}

function formStateToOverrides(state: ReturnType<typeof overridesToFormState>): MassingOverrides {
	const d = MASSING_DEFAULTS;
	return {
		lotLengthFt: parseNum(state.lotLengthFt, d.lotLengthFt),
		lotWidthFt: parseNum(state.lotWidthFt, d.lotWidthFt),
		frontWallFt: parseNum(state.frontWallFt, d.frontWallFt),
		backWallFt: parseNum(state.backWallFt, d.backWallFt),
		leftWallFt: parseNum(state.leftWallFt, d.leftWallFt),
		rightWallFt: parseNum(state.rightWallFt, d.rightWallFt),
		baseHeightFt: parseNum(state.baseHeightFt, d.baseHeightFt),
		buildingHeightFt: parseNum(state.buildingHeightFt, d.buildingHeightFt),
		setbackStartFt: parseNum(state.setbackStartFt, d.setbackStartFt),
		frontSetbackFt: parseNum(state.frontSetbackFt, d.frontSetbackFt),
		maxHeightFt: parseNum(state.maxHeightFt, d.maxHeightFt),
		showMaxHeightCage: state.showMaxHeightCage,
		xAlign: state.xAlign,
		zAlign: state.zAlign,
		inputsPanelHidden: state.inputsPanelHidden,
	};
}

export default function ReportMassingSection({ reportId }: { reportId: string }) {
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [state, setState] = useState(() => overridesToFormState(null));

	// Load overrides on mount
	useEffect(() => {
		let cancelled = false;
		getReportMassing(reportId)
			.then((overrides) => {
				if (!cancelled) setState(overridesToFormState(overrides));
			})
			.catch(() => {
				if (!cancelled) setState(overridesToFormState(null));
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => { cancelled = true; };
	}, [reportId]);

	const save = useCallback(async () => {
		setSaving(true);
		try {
			const payload = formStateToOverrides(state);
			await patchReportMassing(reportId, payload);
			toast.success("Massing saved");
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Failed to save");
		} finally {
			setSaving(false);
		}
	}, [reportId, state]);

	const hidePanel = useCallback(async () => {
		setState((s) => ({ ...s, inputsPanelHidden: true }));
		setSaving(true);
		try {
			const payload = formStateToOverrides({ ...state, inputsPanelHidden: true });
			await patchReportMassing(reportId, payload);
		} catch {
			// Revert on error
			setState((s) => ({ ...s, inputsPanelHidden: false }));
		} finally {
			setSaving(false);
		}
	}, [reportId, state]);

	const d = MASSING_DEFAULTS;
	const lotL = parseNum(state.lotLengthFt, d.lotLengthFt);
	const lotW = parseNum(state.lotWidthFt, d.lotWidthFt);
	const valid = lotL > 0 && lotW > 0 && SCALE > 0;
	const frontW = parseNum(state.frontWallFt, d.frontWallFt);
	const backW = parseNum(state.backWallFt, d.backWallFt);
	const leftW = parseNum(state.leftWallFt, d.leftWallFt);
	const rightW = parseNum(state.rightWallFt, d.rightWallFt);
	const baseH = parseNum(state.baseHeightFt, d.baseHeightFt);
	const buildingH = parseNum(state.buildingHeightFt, d.buildingHeightFt);
	const setbackStart = parseNum(state.setbackStartFt, d.setbackStartFt);
	const frontSetback = parseNum(state.frontSetbackFt, d.frontSetbackFt);
	const maxHeight = parseNum(state.maxHeightFt, d.maxHeightFt);

	if (loading) {
		return (
			<Card id="property-massing-3d" className="mb-6 scroll-mt-8">
				<CardContent className="pt-6">
					<div className="flex items-center gap-2 mb-1">
						<Box className="size-5 text-[#4090C2]" />
						<h3 className="text-lg font-semibold text-[#37322F]">3D Massing Visualization</h3>
					</div>
					<p className="text-sm text-[#605A57] mb-4">Loading…</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card id="property-massing-3d" className="mb-6 scroll-mt-8">
			<CardContent className="pt-6">
				<div className="mb-4">
					<div className="flex items-center gap-2 mb-1">
						<Box className="size-5 text-[#4090C2]" />
						<h3 className="text-lg font-semibold text-[#37322F]">3D Massing Visualization</h3>
					</div>
					<p className="text-sm text-[#605A57]">
						Interactive 3D massing. Edit inputs below and click Save to store for this report.
					</p>
				</div>

				{/* 3D on top */}
				<div className="rounded-lg overflow-hidden border border-[rgba(55,50,47,0.12)] bg-white mb-4" style={{ height: HEIGHT_PX }}>
					{!valid ? (
						<div className="w-full h-full flex items-center justify-center text-sm text-[#605A57]">
							Enter valid lot dimensions (length and width).
						</div>
					) : (
						<Suspense fallback={<div className="w-full h-full flex items-center justify-center text-sm text-[#605A57]">Loading 3D…</div>}>
							<Canvas camera={{ position: [d.cameraPosX, d.cameraPosY, d.cameraPosZ], fov: 50 }} gl={{ antialias: true }}>
								<MassingSandboxScene
									lotLengthFt={lotL}
									lotWidthFt={lotW}
									scale={SCALE}
									groundColor={d.groundColor}
									lotSlabHeightFt={d.lotSlabHeightFt}
									lotSlabPaddingFt={d.lotSlabPaddingFt}
									ambientLightIntensity={d.ambientLightIntensity}
									directionalLightIntensity={d.directionalLightIntensity}
									frontWallFt={frontW}
									backWallFt={backW}
									leftWallFt={leftW}
									rightWallFt={rightW}
									baseHeightFt={baseH}
									buildingHeightFt={buildingH}
									setbackStartFt={setbackStart}
									frontSetbackFt={frontSetback}
									maxHeightFt={maxHeight}
									showMaxHeightCage={state.showMaxHeightCage}
									xAlign={state.xAlign}
									zAlign={state.zAlign}
								/>
							</Canvas>
						</Suspense>
					)}
				</div>

				{/* Hideable inputs: top row Save + Hide, then form */}
				{state.inputsPanelHidden ? (
					<Button variant="outline" size="sm" onClick={() => setState((s) => ({ ...s, inputsPanelHidden: false }))}>
						Show inputs
					</Button>
				) : (
					<div className="space-y-4 rounded-lg border border-[rgba(55,50,47,0.12)] p-4 bg-white">
						<div className="flex items-center gap-2">
							<Button size="sm" onClick={save} disabled={saving}>
								{saving ? "Saving…" : "Save"}
							</Button>
							<Button variant="outline" size="sm" onClick={hidePanel} disabled={saving}>
								Hide inputs
							</Button>
						</div>
						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-1.5">
								<Label htmlFor="rpt-lotLength" className="text-xs">Lot length (ft)</Label>
								<Input id="rpt-lotLength" type="number" min={1} value={state.lotLengthFt} onChange={(e) => setState((s) => ({ ...s, lotLengthFt: e.target.value }))} className="h-8" />
							</div>
							<div className="space-y-1.5">
								<Label htmlFor="rpt-lotWidth" className="text-xs">Lot width (ft)</Label>
								<Input id="rpt-lotWidth" type="number" min={1} value={state.lotWidthFt} onChange={(e) => setState((s) => ({ ...s, lotWidthFt: e.target.value }))} className="h-8" />
							</div>
						</div>
						<div className="space-y-2">
							<Label className="text-xs font-semibold text-[#605A57]">Building positioning</Label>
							<div className="grid grid-cols-2 gap-2">
								<div className="space-y-1.5">
									<Label className="text-xs">Left vs Right</Label>
									<Select value={state.xAlign} onValueChange={(v) => setState((s) => ({ ...s, xAlign: v as "left" | "center" | "right" }))}>
										<SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
										<SelectContent>
											<SelectItem value="left">Left</SelectItem>
											<SelectItem value="center">Center</SelectItem>
											<SelectItem value="right">Right</SelectItem>
										</SelectContent>
									</Select>
								</div>
								<div className="space-y-1.5">
									<Label className="text-xs">Front vs Back</Label>
									<Select value={state.zAlign} onValueChange={(v) => setState((s) => ({ ...s, zAlign: v as "front" | "center" | "back" }))}>
										<SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
										<SelectContent>
											<SelectItem value="front">Front</SelectItem>
											<SelectItem value="center">Center</SelectItem>
											<SelectItem value="back">Back</SelectItem>
										</SelectContent>
									</Select>
								</div>
							</div>
						</div>
						<div className="space-y-2">
							<Label className="text-xs font-semibold text-[#605A57]">Building walls (ft)</Label>
							<div className="grid grid-cols-2 gap-2">
								<div className="space-y-1">
									<Label htmlFor="rpt-frontWall" className="text-xs">Front</Label>
									<Input id="rpt-frontWall" type="number" min={0} value={state.frontWallFt} onChange={(e) => setState((s) => ({ ...s, frontWallFt: e.target.value }))} className="h-8" />
								</div>
								<div className="space-y-1">
									<Label htmlFor="rpt-backWall" className="text-xs">Back</Label>
									<Input id="rpt-backWall" type="number" min={0} value={state.backWallFt} onChange={(e) => setState((s) => ({ ...s, backWallFt: e.target.value }))} className="h-8" />
								</div>
								<div className="space-y-1">
									<Label htmlFor="rpt-leftWall" className="text-xs">Left</Label>
									<Input id="rpt-leftWall" type="number" min={0} value={state.leftWallFt} onChange={(e) => setState((s) => ({ ...s, leftWallFt: e.target.value }))} className="h-8" />
								</div>
								<div className="space-y-1">
									<Label htmlFor="rpt-rightWall" className="text-xs">Right</Label>
									<Input id="rpt-rightWall" type="number" min={0} value={state.rightWallFt} onChange={(e) => setState((s) => ({ ...s, rightWallFt: e.target.value }))} className="h-8" />
								</div>
							</div>
						</div>
						<div className="space-y-2">
							<Label className="text-xs font-semibold text-[#605A57]">Height and setbacks</Label>
							<div className="grid grid-cols-2 gap-2">
								<div className="space-y-1">
									<Label htmlFor="rpt-baseHeight" className="text-xs">Base height (ft)</Label>
									<Input id="rpt-baseHeight" type="number" min={0} value={state.baseHeightFt} onChange={(e) => setState((s) => ({ ...s, baseHeightFt: e.target.value }))} className="h-8" />
								</div>
								<div className="space-y-1">
									<Label htmlFor="rpt-buildingHeight" className="text-xs">Building height (ft)</Label>
									<Input id="rpt-buildingHeight" type="number" min={0} value={state.buildingHeightFt} onChange={(e) => setState((s) => ({ ...s, buildingHeightFt: e.target.value }))} className="h-8" />
								</div>
								<div className="space-y-1">
									<Label htmlFor="rpt-setbackStart" className="text-xs">Setback height (ft)</Label>
									<Input id="rpt-setbackStart" type="number" min={0} value={state.setbackStartFt} onChange={(e) => setState((s) => ({ ...s, setbackStartFt: e.target.value }))} className="h-8" />
								</div>
								<div className="space-y-1">
									<Label htmlFor="rpt-frontSetback" className="text-xs">Upper story setback (ft)</Label>
									<Input id="rpt-frontSetback" type="number" min={0} value={state.frontSetbackFt} onChange={(e) => setState((s) => ({ ...s, frontSetbackFt: e.target.value }))} className="h-8" />
								</div>
								<div className="space-y-1">
									<Label htmlFor="rpt-maxHeight" className="text-xs">Max height (ft)</Label>
									<Input id="rpt-maxHeight" type="number" min={0} value={state.maxHeightFt} onChange={(e) => setState((s) => ({ ...s, maxHeightFt: e.target.value }))} className="h-8" />
								</div>
							</div>
							<div className="flex items-center gap-2">
								<input
									id="rpt-showCage"
									type="checkbox"
									checked={state.showMaxHeightCage}
									onChange={(e) => setState((s) => ({ ...s, showMaxHeightCage: e.target.checked }))}
									className="h-4 w-4 rounded border-[rgba(55,50,47,0.24)]"
								/>
								<Label htmlFor="rpt-showCage" className="text-xs cursor-pointer">Show max height cage</Label>
							</div>
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
