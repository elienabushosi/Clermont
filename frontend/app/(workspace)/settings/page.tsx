"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
	getCurrentUser,
	requestPasswordReset,
	resetPassword,
} from "@/lib/auth";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Lock, CreditCard, Mail, CheckCircle2 } from "lucide-react";
import { config } from "@/lib/config";

const passwordResetSchema = z.object({
	code: z.string().min(6, "Code must be at least 6 characters").max(10, "Code must be 10 characters or less"),
	newPassword: z
		.string()
		.min(6, "Password must be at least 6 characters"),
	confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
	message: "Passwords do not match",
	path: ["confirmPassword"],
});

type PasswordResetFormValues = z.infer<typeof passwordResetSchema>;

export default function SettingsPage() {
	const searchParams = useSearchParams();
	const [currentUser, setCurrentUser] = useState<{
		user: {
			IdUser: string;
			Name: string;
			Email: string;
			Role: string;
		};
	} | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isRequestingCode, setIsRequestingCode] = useState(false);
	const [isResetting, setIsResetting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [codeSent, setCodeSent] = useState(false);

	const isOwner = currentUser?.user.Role === "Owner";

	const form = useForm<PasswordResetFormValues>({
		resolver: zodResolver(passwordResetSchema),
		defaultValues: {
			code: "",
			newPassword: "",
			confirmPassword: "",
		},
	});

	useEffect(() => {
		const fetchUser = async () => {
			try {
				const user = await getCurrentUser();
				setCurrentUser(user);
			} catch (err) {
				console.error("Error fetching user:", err);
			} finally {
				setIsLoading(false);
			}
		};

		fetchUser();

		// Check if code is in URL (from email link)
		const codeFromUrl = searchParams.get("resetCode");
		if (codeFromUrl) {
			form.setValue("code", codeFromUrl);
			setCodeSent(true); // Auto-show form if code is in URL
		}
	}, [searchParams, form]);

	const handleRequestCode = async () => {
		setIsRequestingCode(true);
		setError(null);
		setSuccess(null);
		setCodeSent(false);

		try {
			const response = await fetch(
				`${config.apiUrl}/api/auth/password/request-reset`,
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
						"Content-Type": "application/json",
					},
				}
			);

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.message || "Failed to send password reset code");
			}

			setCodeSent(true);
			setSuccess("Password reset code sent to your email");
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: "Failed to request password reset code"
			);
		} finally {
			setIsRequestingCode(false);
		}
	};

	const onSubmit = async (data: PasswordResetFormValues) => {
		setIsResetting(true);
		setError(null);
		setSuccess(null);

		try {
			await resetPassword(data.code, data.newPassword);
			setSuccess("Password updated successfully!");
			form.reset();
			setCodeSent(false);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to reset password"
			);
		} finally {
			setIsResetting(false);
		}
	};

	if (isLoading) {
		return (
			<div className="p-8">
				<div className="max-w-4xl mx-auto">
					<h1 className="text-2xl font-semibold text-[#37322F] mb-6">
						Settings
					</h1>
					<div className="space-y-6">
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Lock className="h-5 w-5" />
									Change Password
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<Skeleton className="h-4 w-full" />
								<Skeleton className="h-4 w-3/4" />
								<Skeleton className="h-10 w-48" />
							</CardContent>
						</Card>
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<CreditCard className="h-5 w-5" />
									Billing
								</CardTitle>
							</CardHeader>
							<CardContent>
								<Skeleton className="h-4 w-full" />
								<Skeleton className="h-4 w-2/3 mt-2" />
							</CardContent>
						</Card>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="p-8">
			<div className="max-w-4xl mx-auto">
				<h1 className="text-2xl font-semibold text-[#37322F] mb-6">
					Settings
				</h1>

				<div className="space-y-6">
					{/* Change Password Section */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Lock className="h-5 w-5" />
								Change Password
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							{!codeSent ? (
								<div className="space-y-4">
									<p className="text-sm text-[#605A57]">
										Click the button below to receive a password reset code via
										email. The code will expire in 15 minutes.
									</p>
									<Button
										onClick={handleRequestCode}
										disabled={isRequestingCode}
										className="bg-[#37322F] hover:bg-[#37322F]/90 text-white"
									>
										{isRequestingCode ? (
											"Sending..."
										) : (
											<>
												<Mail className="h-4 w-4 mr-2" />
												Send Password Reset Code
											</>
										)}
									</Button>
								</div>
							) : (
								<Form {...form}>
									<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
										{success && (
											<div className="p-3 bg-green-50 border border-green-200 rounded-md flex items-center gap-2 text-green-700 text-sm">
												<CheckCircle2 className="h-4 w-4" />
												{success}
											</div>
										)}
										{error && (
											<div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
												{error}
											</div>
										)}
										<FormField
											control={form.control}
											name="code"
											render={({ field }) => (
												<FormItem>
													<FormLabel className="text-[#37322F]">
														Reset Code
													</FormLabel>
													<FormControl>
														<Input
															type="text"
															placeholder="Enter reset code"
															maxLength={10}
															{...field}
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
										<FormField
											control={form.control}
											name="newPassword"
											render={({ field }) => (
												<FormItem>
													<FormLabel className="text-[#37322F]">
														New Password
													</FormLabel>
													<FormControl>
														<Input
															type="password"
															placeholder="Enter new password"
															{...field}
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
										<FormField
											control={form.control}
											name="confirmPassword"
											render={({ field }) => (
												<FormItem>
													<FormLabel className="text-[#37322F]">
														Confirm New Password
													</FormLabel>
													<FormControl>
														<Input
															type="password"
															placeholder="Confirm new password"
															{...field}
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
										<div className="flex gap-3">
											<Button
												type="submit"
												disabled={isResetting}
												className="bg-[#37322F] hover:bg-[#37322F]/90 text-white"
											>
												{isResetting ? "Updating..." : "Update Password"}
											</Button>
											<Button
												type="button"
												variant="outline"
											onClick={() => {
												setCodeSent(false);
												form.reset();
												setError(null);
												setSuccess(null);
											}}
											>
												Cancel
											</Button>
										</div>
									</form>
								</Form>
							)}
						</CardContent>
					</Card>

					{/* Billing Section - Owner Only */}
					{isOwner && (
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<CreditCard className="h-5 w-5" />
									Billing
								</CardTitle>
							</CardHeader>
							<CardContent>
								<p className="text-sm text-[#605A57]">
									Billing information and subscription management will be available
									here.
								</p>
							</CardContent>
						</Card>
					)}
				</div>
			</div>
		</div>
	);
}

