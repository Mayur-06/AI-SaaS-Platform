import React from 'react';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '../ui/Accordion';

export const FaqSection = () => {
  const faqs = [
    {
      id: 'rag',
      q: 'What is RAG and how does Hapy use it to prevent hallucinations?',
      a: 'RAG stands for Retrieval-Augmented Generation. Instead of having an AI guess or hallucinate from general web data, Hapy indexes your organization’s uploaded documents in a private vector store. When you ask a question, relevant segments are retrieved and passed to the model as grounding context, with direct page citations provided.',
    },
    {
      id: 'cache',
      q: 'How does semantic caching reduce cost and response time?',
      a: 'Semantic caching calculates vector cosine similarity for incoming questions. If someone asks a question semantically equivalent to one recently processed, Hapy immediately returns the cached high-confidence response in milliseconds, without sending an expensive call to external LLMs.',
    },
    {
      id: 'privacy',
      q: 'Is my organization’s data private and isolated from other tenants?',
      a: 'Yes, strictly. Hapy enforces strict multi-tenancy at the database and vector storage layers. Every document, vector chunk, and user query is scoped to your specific Organization ID. Your confidential business documents are never shared or used to train public models.',
    },
    {
      id: 'models',
      q: 'Which AI models are supported and how does auto-fallback work?',
      a: 'Hapy is model-agnostic. We support leading models including Google Gemini, OpenAI GPT, and Anthropic Claude. If a primary provider experiences downtime or rate limits, our routing engine automatically falls back to an alternate model so your workflows never halt.',
    },
    {
      id: 'roles',
      q: 'What team roles and collaboration features are available?',
      a: 'Organizations support four distinct role levels: Owner (billing, deletion, transfer), Admin (invitations, document uploads, API keys), Member (querying and reading), and Viewer (read-only queries). You can invite members via unique cryptographic invite tokens.',
    },
    {
      id: 'billing',
      q: 'Can I change my plan or cancel at any time?',
      a: 'Yes. You can upgrade, downgrade, or cancel your subscription plan at any moment from the Billing & Usage tab. Plan limits take effect immediately, and prorated differences are automatically handled.',
    },
  ];

  return (
    <section id="faq" className="py-20 lg:py-28 bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#b2c147]/15 text-[#292929] text-xs font-semibold uppercase tracking-wider mb-4">
            Got Questions?
          </div>
          <h2
            style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#292929] tracking-tight mb-4"
          >
            Frequently Asked Questions
          </h2>
          <p className="text-base sm:text-lg text-gray-600 leading-relaxed">
            Everything you need to know about the architecture, security, and pricing.
          </p>
        </div>

        {/* Radix FAQ Accordion */}
        <Accordion type="single" collapsible defaultValue="rag" className="space-y-3">
          {faqs.map((faq) => (
            <AccordionItem
              key={faq.id}
              value={faq.id}
              className="rounded-2xl border border-gray-200 hover:border-gray-300 bg-white px-6 transition-all data-[state=open]:border-[#b2c147] data-[state=open]:bg-[#b2c147]/5 data-[state=open]:shadow-sm"
            >
              <AccordionTrigger
                style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
                className="text-base sm:text-lg font-bold text-[#292929] hover:no-underline"
              >
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-gray-600 leading-relaxed pt-1">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
};
