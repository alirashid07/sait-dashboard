import { useState } from "react";

interface GuidedWorkflowProps {
  onComplete: (data: { file: File | null; complianceType: "GRI" | "IFRS"; omissions: { [key: string]: string } }) => void;
}

export default function GuidedWorkflow({ onComplete }: GuidedWorkflowProps) {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [complianceType, setComplianceType] = useState<"GRI" | "IFRS">("GRI");
  const [omissions, setOmissions] = useState<{ [key: string]: string }>({});
  const [selectedDisclosure, setSelectedDisclosure] = useState<string>("");
  const [omissionReason, setOmissionReason] = useState<string>("");

  const disclosures = [
    "GRI 2: General Disclosures 2021_2-1",
    "GRI 2: General Disclosures 2021_2-2",
    "GRI 3: Material Topics 2021_3-1",
    "GRI 3: Material Topics 2021_3-2",
    "GRI 101: Biodiversity 2024_101-1",
    "GRI 305: Emissions 2016_305-1",
  ];

  const reasons = [
    "not applicable",
    "confidential",
    "legal prohibition",
    "information unavailable",
  ];

  const addOmission = () => {
    if (selectedDisclosure && omissionReason) {
      setOmissions((prev) => ({
        ...prev,
        [selectedDisclosure]: omissionReason,
      }));
      setSelectedDisclosure("");
      setOmissionReason("");
    }
  };

  const removeOmission = (key: string) => {
    const newOmissions = { ...omissions };
    delete newOmissions[key];
    setOmissions(newOmissions);
  };

  const handleNext = () => {
    if (step === 4) {
      onComplete({ file, complianceType, omissions });
    } else {
      setStep(step + 1);
    }
  };

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center" }}>
      <div style={{ background: "white", padding: "20px", borderRadius: "8px", width: "500px" }}>
        <h2>Guided Setup - Step {step} of 4</h2>
        {step === 1 && (
          <div>
            <p>Welcome! Let’s get started. First, select the compliance framework you want to analyze.</p>
            <div style={{ margin: "10px 0" }}>
              <button
                className={`option-button ${complianceType === "GRI" ? "active" : ""}`}
                onClick={() => setComplianceType("GRI")}
              >
                GRI Compliance
              </button>
              <button
                className={`option-button ${complianceType === "IFRS" ? "active" : ""}`}
                onClick={() => setComplianceType("IFRS")}
              >
                IFRS Compliance
              </button>
            </div>
          </div>
        )}
        {step === 2 && (
          <div>
            <p>Upload the document you want to analyze for compliance.</p>
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="file-input"
              style={{ margin: "10px 0" }}
            />
          </div>
        )}
        {step === 3 && (
          <div>
            <p>Specify any disclosures you wish to omit and the reason for omission (optional).</p>
            <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
              <select
                value={selectedDisclosure}
                onChange={(e) => setSelectedDisclosure(e.target.value)}
                className="login-input"
              >
                <option value="">Select Disclosure</option>
                {disclosures.map((disclosure) => (
                  <option key={disclosure} value={disclosure}>
                    {disclosure}
                  </option>
                ))}
              </select>
              <select
                value={omissionReason}
                onChange={(e) => setOmissionReason(e.target.value)}
                className="login-input"
              >
                <option value="">Select Reason</option>
                {reasons.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
              <button onClick={addOmission} className="login-button">Add Omission</button>
            </div>
            {Object.keys(omissions).length > 0 && (
              <div>
                <h4>Specified Omissions:</h4>
                <ul>
                  {Object.entries(omissions).map(([key, value]) => (
                    <li key={key}>
                      {key}: {value} <button onClick={() => removeOmission(key)} style={{ color: "red" }}>Remove</button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        {step === 4 && (
          <div>
            <p>You’re ready to analyze your document! Click "Finish" to generate the report.</p>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "20px" }}>
          <button onClick={() => setStep(step - 1)} disabled={step === 1} className="login-button">
            Previous
          </button>
          <button onClick={handleNext} className="login-button">
            {step === 4 ? "Finish" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
