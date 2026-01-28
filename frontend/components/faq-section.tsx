"use client";

import { useState } from "react";

interface FAQItem {
	question: string;
	answer: string;
}

const faqData: FAQItem[] = [
	{
		question: "What is Lindero and who is it for?",
		answer: "Lindero is a feasibility and site-intelligence tool built for developers & architects. It helps developers & architects quickly understand what is possible on a property by generating a zoning and land-use feasibility summary from a client’s address. Lindero is designed for developers & architects who want clarity before design begins.",
	},
	{
		question: "How does Lindero work?",
		answer: "Lindero starts with a property address. Using that address, it pulls parcel-level data such as zoning classification, land use, and lot characteristics, then interprets what is allowed or restricted on the site. The result is a clear, architect-friendly feasibility summary that can be reviewed before the first client meeting.",
	},
	{
		question: "What kind of questions does Lindero help answer?",
		answer: "Lindero helps answer early feasibility questions like whether a site can be built on, what types of uses are allowed, and whether a property can be converted between single-family and multi-residential use. It is designed to support go/no-go decisions before investing in design work.",
	},
	{
		question: "Is Lindero a replacement for full zoning or legal review?",
		answer: "No. Lindero is intended for early-stage feasibility and decision-making. It provides clarity and direction, but it does not replace detailed zoning analysis, legal review, or consultation with local authorities during permitting.",
	},
	{
		question:
			"How is Lindero different from using ChatGPT or public zoning sites?",
		answer: "Lindero centralizes parcel data and zoning interpretation into a single, repeatable workflow. Instead of manually pulling data from multiple tools and interpreting it each time, Lindero provides a structured feasibility summary tied directly to a specific property and client.",
	},
	{
		question: "How do I get started with Lindero?",
		answer: "Getting started is simple. Create an account and log in, then you can search for different property addresses and generate feasibility reports instantly. You can also connect Lindero to your client intake flow, letting you organize multiple projects or clients. For each address you enter, Lindero will generate a feasibility snapshot you can reference during your client conversations.",
	},
];

function ChevronDownIcon({ className }: { className?: string }) {
	return (
		<svg
			className={className}
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
		>
			<path
				d="m6 9 6 6 6-6"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

export default function FAQSection() {
	const [openItems, setOpenItems] = useState<number[]>([]);

	const toggleItem = (index: number) => {
		setOpenItems((prev) =>
			prev.includes(index)
				? prev.filter((i) => i !== index)
				: [...prev, index]
		);
	};

	return (
		<div className="w-full flex justify-center items-start">
			<div className="flex-1 px-4 md:px-12 py-16 md:py-20 flex flex-col lg:flex-row justify-start items-start gap-6 lg:gap-12">
				{/* Left Column - Header */}
				<div className="w-full lg:flex-1 flex flex-col justify-center items-start gap-4 lg:py-5">
					<div className="w-full flex flex-col justify-center text-[#49423D] font-semibold leading-tight md:leading-[44px] font-sans text-4xl tracking-tight">
						Frequently Asked Questions
					</div>
					<div className="w-full text-[#605A57] text-base font-normal leading-7 font-sans">
						Explore what's possible on a property before you start design work & bring your team together.
					</div>
				</div>

				{/* Right Column - FAQ Items */}
				<div className="w-full lg:flex-1 flex flex-col justify-center items-center">
					<div className="w-full flex flex-col">
						{faqData.map((item, index) => {
							const isOpen = openItems.includes(index);

							return (
								<div
									key={index}
									className="w-full border-b border-[rgba(73,66,61,0.16)] overflow-hidden"
								>
									<button
										onClick={() => toggleItem(index)}
										className="w-full px-5 py-[18px] flex justify-between items-center gap-5 text-left hover:bg-[rgba(73,66,61,0.02)] transition-colors duration-200"
										aria-expanded={isOpen}
									>
										<div className="flex-1 text-[#49423D] text-base font-medium leading-6 font-sans">
											{item.question}
										</div>
										<div className="flex justify-center items-center">
											<ChevronDownIcon
												className={`w-6 h-6 text-[rgba(73,66,61,0.60)] transition-transform duration-300 ease-in-out ${
													isOpen
														? "rotate-180"
														: "rotate-0"
												}`}
											/>
										</div>
									</button>

									<div
										className={`overflow-hidden transition-all duration-300 ease-in-out ${
											isOpen
												? "max-h-96 opacity-100"
												: "max-h-0 opacity-0"
										}`}
									>
										<div className="px-5 pb-[18px] text-[#605A57] text-sm font-normal leading-6 font-sans">
											{item.answer}
										</div>
									</div>
								</div>
							);
						})}
					</div>
				</div>
			</div>
		</div>
	);
}
