"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
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
import Link from "next/link";

const loginSchema = z.object({
	email: z.string().email("Please enter a valid email address"),
	password: z.string().min(1, "Password is required"),
});

const forgotPasswordSchema = z.object({
	email: z.string().email("Please enter a valid email address"),
});

const resetPasswordSchema = z.object({
	email: z.string().email("Please enter a valid email address"),
	code: z.string().min(6, "Code must be at least 6 characters").max(10, "Code must be 10 characters or less"),
	newPassword: z
		.string()
		.min(6, "Password must be at least 6 characters"),
	confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
	message: "Passwords do not match",
	path: ["confirmPassword"],
});

type LoginFormValues = z.infer<typeof loginSchema>;
type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;
type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

export default function LoginPage() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [isLoading, setIsLoading] = useState(false);
	const [isSuccess, setIsSuccess] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [showForgotPassword, setShowForgotPassword] = useState(false);
	const [codeSent, setCodeSent] = useState(false);
	const [isRequestingCode, setIsRequestingCode] = useState(false);
	const [isResetting, setIsResetting] = useState(false);
	const [resetSuccess, setResetSuccess] = useState(false);

	const form = useForm<LoginFormValues>({
		resolver: zodResolver(loginSchema),
		defaultValues: {
			email: "",
			password: "",
		},
	});

	const forgotPasswordForm = useForm<ForgotPasswordFormValues>({
		resolver: zodResolver(forgotPasswordSchema),
		defaultValues: {
			email: "",
		},
	});

	const resetPasswordForm = useForm<ResetPasswordFormValues>({
		resolver: zodResolver(resetPasswordSchema),
		defaultValues: {
			email: "",
			code: "",
			newPassword: "",
			confirmPassword: "",
		},
	});

	// Check if code is in URL (from email link)
	useEffect(() => {
		const codeFromUrl = searchParams.get("resetCode");
		if (codeFromUrl) {
			setShowForgotPassword(true);
			setCodeSent(true);
			resetPasswordForm.setValue("code", codeFromUrl);
		}
	}, [searchParams, resetPasswordForm]);

	const onSubmit = async (data: LoginFormValues) => {
		setError(null);
		setIsLoading(true);

		try {
			// Normalize email to lowercase for case-insensitive login
			const normalizedData = {
				...data,
				email: data.email.toLowerCase().trim(),
			};

			const response = await fetch(
				"http://localhost:3002/api/auth/login",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify(normalizedData),
				}
			);

			const result = await response.json();

			if (!response.ok) {
				setError(result.message || "Invalid email or password");
				setIsLoading(false);
				return;
			}

			// Success - store the token if provided
			if (result.token) {
				localStorage.setItem("auth_token", result.token);
			}

			// Wait 1 second, then turn button green
			setTimeout(() => {
				setIsSuccess(true);
				// Navigate to home page after showing success
				setTimeout(() => {
					router.push("/home");
				}, 500);
			}, 1000);
		} catch (error) {
			console.error("Login error:", error);
			setError("An error occurred. Please try again.");
			setIsLoading(false);
		}
	};

	const onForgotPasswordSubmit = async (data: ForgotPasswordFormValues) => {
		setIsRequestingCode(true);
		setError(null);

		try {
			const response = await fetch(
				"http://localhost:3002/api/auth/password/forgot",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						email: data.email.toLowerCase().trim(),
					}),
				}
			);

			const result = await response.json();

			if (!response.ok) {
				setError(result.message || "Failed to send password reset code");
				setIsRequestingCode(false);
				return;
			}

			setCodeSent(true);
			resetPasswordForm.setValue("email", data.email.toLowerCase().trim());
			setIsRequestingCode(false);
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: "Failed to request password reset code"
			);
			setIsRequestingCode(false);
		}
	};

	const onResetPasswordSubmit = async (data: ResetPasswordFormValues) => {
		setIsResetting(true);
		setError(null);
		setResetSuccess(false);

		try {
			const response = await fetch(
				"http://localhost:3002/api/auth/password/reset-with-code",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						email: data.email.toLowerCase().trim(),
						code: data.code,
						newPassword: data.newPassword,
					}),
				}
			);

			const result = await response.json();

			if (!response.ok) {
				setError(result.message || "Failed to reset password");
				setIsResetting(false);
				return;
			}

			setResetSuccess(true);
			setIsResetting(false);
			
			// Redirect to login after 2 seconds
			setTimeout(() => {
				setShowForgotPassword(false);
				setCodeSent(false);
				resetPasswordForm.reset();
				forgotPasswordForm.reset();
				setResetSuccess(false);
			}, 2000);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to reset password"
			);
			setIsResetting(false);
		}
	};

	return (
		<div className="w-full min-h-screen bg-[#F7F5F3] flex items-center justify-center p-4">
			<div className="w-full max-w-md">
				<button
					onClick={() => router.push("/")}
					className="mb-4 flex items-center gap-2 text-[#37322F] hover:text-[#4090C2] transition-colors text-sm font-medium"
				>
					<ArrowLeft className="w-4 h-4" />
					Back
				</button>
				<div className="bg-white rounded-lg shadow-sm border border-[rgba(55,50,47,0.12)] p-8">
					<h1 className="text-2xl font-semibold text-[#37322F] mb-6">
						Log in to Lindero
					</h1>
					<Form {...form}>
						<form
							onSubmit={form.handleSubmit(onSubmit)}
							className="space-y-6"
						>
							<FormField
								control={form.control}
								name="email"
								render={({ field }) => (
									<FormItem>
										<FormLabel className="text-[#37322F]">
											Email
										</FormLabel>
										<FormControl>
											<Input
												type="email"
												placeholder="Enter your email"
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="password"
								render={({ field }) => (
									<FormItem>
										<div className="flex items-center justify-between">
											<FormLabel className="text-[#37322F]">
												Password
											</FormLabel>
											<button
												type="button"
												onClick={() => setShowForgotPassword(true)}
												className="text-sm text-[#4090C2] hover:text-[#37322F] transition-colors"
											>
												Forgot Password?
											</button>
										</div>
										<FormControl>
											<Input
												type="password"
												placeholder="Enter your password"
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							{error && (
								<div className="text-sm text-red-600">
									{error}
								</div>
							)}
							<Button
								type="submit"
								disabled={isLoading || isSuccess}
								className={`w-full text-white ${
									isSuccess
										? "bg-green-600 hover:bg-green-700"
										: "bg-[#37322F] hover:bg-[#37322F]/90"
								}`}
							>
								{isLoading
									? "Logging in..."
									: isSuccess
									? "Access granted"
									: "Log in"}
							</Button>
						</form>
						<div className="mt-6 text-center">
							<Link
								href="/signup"
								className="text-sm text-[#37322F] hover:text-[#4090C2] transition-colors underline"
							>
								Create an account
							</Link>
						</div>
					</Form>

					{/* Forgot Password Flow */}
					{showForgotPassword && (
						<div className="mt-6 pt-6 border-t border-[rgba(55,50,47,0.12)]">
							{!codeSent ? (
								<>
									<h2 className="text-xl font-semibold text-[#37322F] mb-4">
										Forgot Password
									</h2>
									<Form {...forgotPasswordForm}>
										<form
											onSubmit={forgotPasswordForm.handleSubmit(onForgotPasswordSubmit)}
											className="space-y-4"
										>
											<FormField
												control={forgotPasswordForm.control}
												name="email"
												render={({ field }) => (
													<FormItem>
														<FormLabel className="text-[#37322F]">
															Email
														</FormLabel>
														<FormControl>
															<Input
																type="email"
																placeholder="Enter your email"
																{...field}
															/>
														</FormControl>
														<FormMessage />
													</FormItem>
												)}
											/>
											{error && (
												<div className="text-sm text-red-600">{error}</div>
											)}
											<div className="flex gap-3">
												<Button
													type="submit"
													disabled={isRequestingCode}
													className="flex-1 bg-[#37322F] hover:bg-[#37322F]/90 text-white"
												>
													{isRequestingCode ? "Sending..." : "Send Reset Code"}
												</Button>
												<Button
													type="button"
													variant="outline"
													onClick={() => {
														setShowForgotPassword(false);
														forgotPasswordForm.reset();
														setError(null);
													}}
												>
													Cancel
												</Button>
											</div>
										</form>
									</Form>
								</>
							) : (
								<>
									<h2 className="text-xl font-semibold text-[#37322F] mb-4">
										Reset Password
									</h2>
									{resetSuccess && (
										<div className="p-3 bg-green-50 border border-green-200 rounded-md flex items-center gap-2 text-green-700 text-sm mb-4">
											<CheckCircle2 className="h-4 w-4" />
											Password updated successfully! Redirecting to login...
										</div>
									)}
									<Form {...resetPasswordForm}>
										<form
											onSubmit={resetPasswordForm.handleSubmit(onResetPasswordSubmit)}
											className="space-y-4"
										>
											<FormField
												control={resetPasswordForm.control}
												name="email"
												render={({ field }) => (
													<FormItem>
														<FormLabel className="text-[#37322F]">
															Email
														</FormLabel>
														<FormControl>
															<Input
																type="email"
																placeholder="Enter your email"
																{...field}
															/>
														</FormControl>
														<FormMessage />
													</FormItem>
												)}
											/>
											<FormField
												control={resetPasswordForm.control}
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
												control={resetPasswordForm.control}
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
												control={resetPasswordForm.control}
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
											{error && (
												<div className="text-sm text-red-600">{error}</div>
											)}
											<div className="flex gap-3">
												<Button
													type="submit"
													disabled={isResetting || resetSuccess}
													className="flex-1 bg-[#37322F] hover:bg-[#37322F]/90 text-white"
												>
													{isResetting ? "Updating..." : "Update Password"}
												</Button>
												<Button
													type="button"
													variant="outline"
													onClick={() => {
														setCodeSent(false);
														resetPasswordForm.reset();
														forgotPasswordForm.reset();
														setError(null);
														setResetSuccess(false);
													}}
												>
													Cancel
												</Button>
											</div>
										</form>
									</Form>
								</>
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
