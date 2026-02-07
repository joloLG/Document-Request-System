"use client";

import { useState } from "react";
import { FileText, ChevronRight, CheckCircle2, Award, Shield, FileCheck } from "lucide-react";

type Requirement = {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  items: string[];
};

const REQUIREMENTS: Requirement[] = [
  {
    id: "tor",
    title: "Transcript of Records",
    description: "Official record of student's grades and academic progress.",
    icon: <FileText className="h-6 w-6" />,
    items: [
      "Duly accomplished Clearance Form",
      "Documentary Stamp (available at the Cashier)",
      "Official Receipt of Payment",
      "Latest ID Photo (2x2)",
    ],
  },
  {
    id: "diploma",
    title: "Diploma",
    description: "Certificate awarded upon completion of a degree program.",
    icon: <Award className="h-6 w-6" />,
    items: [
      "Notarized Affidavit of Loss (if lost)",
      "Official Receipt of Payment",
      "Duly accomplished Clearance Form",
    ],
  },
  {
    id: "goodmoral",
    title: "Certificate of Good Moral",
    description: "Certification of student's good conduct and behavior.",
    icon: <Shield className="h-6 w-6" />,
    items: [
      "School ID",
      "Official Receipt of Payment",
    ],
  },
  {
    id: "auth",
    title: "Authentication / CAV",
    description: "Certification, Authentication, and Verification for DFA purposes.",
    icon: <FileCheck className="h-6 w-6" />,
    items: [
      "Original Document to be authenticated",
      "Photocopies of the document",
      "Official Receipt of Payment",
      "Valid ID",
    ],
  },
];

export default function StudentRequirementsPage() {
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const toggleExpanded = (id: string) => {
    setExpandedItem(expandedItem === id ? null : id);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 transition-colors duration-300">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sorsuMaroon text-white shadow-lg shadow-maroon-900/20">
            <FileText className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 transition-colors">Requirements</h1>
        </div>

        <p className="text-sm text-gray-600 transition-colors">
          Please ensure you have the following documents ready before requesting specific records.
        </p>

        <div className="space-y-3">
          {REQUIREMENTS.map((requirement) => (
            <div
              key={requirement.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all hover:shadow-md"
            >
              <button
                onClick={() => toggleExpanded(requirement.id)}
                className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center transition-colors ${
                    expandedItem === requirement.id
                      ? "bg-sorsuMaroon text-white shadow-md shadow-maroon-900/20"
                      : "bg-gray-100 text-gray-600"
                  }`}>
                    {requirement.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 transition-colors">
                      {requirement.title}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1 transition-colors">
                      {requirement.description}
                    </p>
                  </div>
                </div>
                <ChevronRight
                  className={`h-5 w-5 text-gray-400 transition-transform ${
                    expandedItem === requirement.id ? "rotate-90" : ""
                  }`}
                />
              </button>

              {expandedItem === requirement.id && (
                <div className="px-6 pb-4 border-t border-gray-100 transition-colors">
                  <div className="pt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <h4 className="text-sm font-semibold text-gray-900 mb-3 transition-colors">
                      Required Documents:
                    </h4>
                    <ul className="space-y-2">
                      {requirement.items.map((item, index) => (
                        <li
                          key={index}
                          className="flex items-start gap-3 text-sm text-gray-600 transition-colors"
                        >
                          <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
