# Lindero — Feasibility Assignment for Architects

## Context

Lindero was requested by Chris, an architect and firm owner, to streamline early-stage client intake and site feasibility analysis prior to the first consultation.

## Problem

When potential clients book a consultation, Chris must manually gather and analyze property data across multiple tools:

- Zoning and land-use interpretation via ChatGPT
- Property and asset data via Zola

This workflow is:

- Fragmented across tools
- Time-consuming per client
- Difficult to standardize
- Hard to reuse or reference later

There is no single source of truth for early feasibility analysis.

## Proposed Solution

Lindero is a client-intake and asset-analysis tool for architects that automatically generates a property feasibility snapshot using only a client's address.

The goal is to provide clear, architect-friendly insight before the first meeting.

## Workflow

### Step 1: Client Intake & Data Pull

Client submits basic signup information on Chris's website, including property address

Lindero uses the address to automatically pull:

- Lot details
- Zoning classification
- Building lot information
- Land-use designation

### Step 2: Feasibility & Use Analysis

Using zoning and land-use codes, Lindero identifies:

- What is allowed vs. restricted on the property
- Feasible use cases, such as:
  - Building on currently unused land
  - Converting single-family → multi-residential
  - Converting multi-residential → single-family

Lindero outputs a clear, structured feasibility summary that Chris can reference during the first client conversation.

## Current Workaround

Today, Chris manually:

- Queries ChatGPT for zoning interpretation
- Uses Zola for property and asset data

Information lives in multiple places with no unified workflow or persistent record.

## Goal

- Centralize client asset data and zoning feasibility into a single system
- Reduce time spent on early-stage analysis
- Improve consistency and repeatability
- Enable higher-quality, more confident first client conversations

