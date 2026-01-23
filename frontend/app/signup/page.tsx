"use client";

import React, { useState, useEffect } from "react";
import { config } from "@/lib/config";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { ArrowLeft } from "lucide-react";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

const signupSchema = z.object({
	email: z.string().email("Please enter a valid email address"),
	firstName: z.string().min(1, "First name is required"),
	password: z.string().min(6, "Password must be at least 6 characters"),
	organizationType: z.enum(["new", "existing"], {
		required_error: "Please select an option",
	}),
	organizationName: z.string().optional(),
	joinCode: z.string().optional(),
}).refine(
	(data) => {
		if (data.organizationType === "new") {
			return data.organizationName && data.organizationName.trim().length > 0;
		}
		if (data.organizationType === "existing") {
			return data.joinCode && data.joinCode.trim().length > 0;
		}
		return true;
	},
	{
		message: "This field is required",
		path: ["organizationName"],
	}
).refine(
	(data) => {
		if (data.organizationType === "existing") {
			return data.joinCode && data.joinCode.trim().length > 0;
		}
		return true;
	},
	{
		message: "Join code is required",
		path: ["joinCode"],
	}
);

type SignupFormValues = z.infer<typeof signupSchema>;

export default function SignupPage() {
	const router = useRouter();
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);
	const [validatingCode, setValidatingCode] = useState(false);
	const [orgInfo, setOrgInfo] = useState<{ name: string } | null>(null);
	const [codeError, setCodeError] = useState<string | null>(null);

	const form = useForm<SignupFormValues>({
		resolver: zodResolver(signupSchema),
		defaultValues: {
			email: "",
			firstName: "",
			password: "",
			organizationType: "new",
			organizationName: "",
			joinCode: "",
		},
	});

	const organizationType = form.watch("organizationType");
	const joinCode = form.watch("joinCode");

	// Validate join code when it changes
	const validateJoinCode = async (code: string) => {
		if (!code || code.trim().length === 0) {
			setOrgInfo(null);
			setCodeError(null);
			return;
		}

		setValidatingCode(true);
		setCodeError(null);

		try {
			const response = await fetch(
				`${config.apiUrl}/api/auth/joincode/validate/${code.toUpperCase()}`
			);

			const result = await response.json();

			if (!response.ok) {
				setCodeError(result.message || "Invalid join code");
				setOrgInfo(null);
				form.setError("joinCode", {
					type: "manual",
					message: result.message || "Invalid join code",
				});
			} else {
				setCodeError(null);
				setOrgInfo({ name: result.organization.Name });
				form.clearErrors("joinCode");
			}
		} catch (error) {
			console.error("Error validating join code:", error);
			setCodeError("Failed to validate join code");
			setOrgInfo(null);
		} finally {
			setValidatingCode(false);
		}
	};

	// Debounce join code validation
	useEffect(() => {
		if (organizationType === "existing" && joinCode) {
			const timer = setTimeout(() => {
				validateJoinCode(joinCode);
			}, 500);

			return () => clearTimeout(timer);
		} else {
			setOrgInfo(null);
			setCodeError(null);
		}
	}, [joinCode, organizationType]);

	const onSubmit = async (data: SignupFormValues) => {
		setError(null);
		setIsLoading(true);

		try {
			const payload: any = {
				email: data.email,
				firstName: data.firstName,
				password: data.password,
			};

			if (data.organizationType === "new") {
				payload.organizationName = data.organizationName;
			} else {
				payload.joinCode = data.joinCode?.toUpperCase();
			}

			const response = await fetch(
				`${config.apiUrl}/api/auth/signup`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify(payload),
				}
			);

			const result = await response.json();

			if (!response.ok) {
				setError(result.message || "Failed to create account");
				setIsLoading(false);
				return;
			}

			// Success
			setSuccess(true);
			// Redirect to login page after a short delay
			setTimeout(() => {
				router.push("/login");
			}, 2000);
		} catch (error) {
			console.error("Signup error:", error);
			setError("An error occurred. Please try again.");
			setIsLoading(false);
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
						Create an account
					</h1>
					<Form {...form}>
						<form
							onSubmit={form.handleSubmit(onSubmit)}
							className="space-y-6"
						>
							<FormField
								control={form.control}
								name="firstName"
								render={({ field }) => (
									<FormItem>
										<FormLabel className="text-[#37322F]">
											First Name
										</FormLabel>
										<FormControl>
											<Input
												type="text"
												placeholder="Enter your first name"
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
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
										<FormLabel className="text-[#37322F]">
											Password
										</FormLabel>
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
							<FormField
								control={form.control}
								name="organizationType"
								render={({ field }) => (
									<FormItem>
										<FormLabel className="text-[#37322F]">
											Join existing organization or new
										</FormLabel>
										<Select
											onValueChange={(value) => {
												field.onChange(value);
												// Clear the other field when switching
												if (value === "new") {
													form.setValue("joinCode", "");
													setOrgInfo(null);
													setCodeError(null);
												} else {
													form.setValue("organizationName", "");
												}
											}}
											defaultValue={field.value}
										>
											<FormControl>
												<SelectTrigger className="w-full">
													<SelectValue placeholder="Select an option" />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												<SelectItem value="new">New</SelectItem>
												<SelectItem value="existing">Existing</SelectItem>
											</SelectContent>
										</Select>
										<FormMessage />
									</FormItem>
								)}
							/>

							{organizationType === "new" && (
								<FormField
									control={form.control}
									name="organizationName"
									render={({ field }) => (
										<FormItem>
											<FormLabel className="text-[#37322F]">
												Organization Name
											</FormLabel>
											<FormControl>
												<Input
													type="text"
													placeholder="Enter your organization name"
													{...field}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
							)}

							{organizationType === "existing" && (
								<FormField
									control={form.control}
									name="joinCode"
									render={({ field }) => (
										<FormItem>
											<FormLabel className="text-[#37322F]">
												Organization Code
											</FormLabel>
											<FormControl>
												<Input
													type="text"
													placeholder="Enter organization code"
													{...field}
													onChange={(e) => {
														field.onChange(e);
														// Validation will happen via useEffect
													}}
													className="uppercase"
												/>
											</FormControl>
											{validatingCode && (
												<p className="text-sm text-[#605A57]">
													Validating code...
												</p>
											)}
											{orgInfo && !validatingCode && (
												<p className="text-sm text-green-600">
													Joining: {orgInfo.name}
												</p>
											)}
											{codeError && !validatingCode && (
												<p className="text-sm text-red-600">{codeError}</p>
											)}
											<FormMessage />
										</FormItem>
									)}
								/>
							)}
							{error && (
								<div className="text-sm text-red-600">
									{error}
								</div>
							)}
							{success && (
								<div className="text-sm text-green-600">
									Account created successfully! Redirecting to
									login...
								</div>
							)}
							<Button
								type="submit"
								disabled={isLoading || success}
								className={`w-full text-white ${
									success
										? "bg-green-600 hover:bg-green-700"
										: "bg-[#37322F] hover:bg-[#37322F]/90"
								}`}
							>
								{isLoading
									? "Creating account..."
									: success
									? "Account created!"
									: "Create account"}
							</Button>
						</form>
					</Form>
				</div>
			</div>
		</div>
	);
}
