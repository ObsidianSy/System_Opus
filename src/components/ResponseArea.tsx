
interface ResponseAreaProps {
  responseText: string;
}

const ResponseArea = ({ responseText }: ResponseAreaProps) => {
  return (
    <div 
      id="respostaProduto" 
      className="mt-6 p-4 bg-gray-100 rounded-md text-center min-h-[60px] flex items-center justify-center text-gray-600"
    >
      {responseText || "Resposta do sistema aparecerá aqui"}
    </div>
  );
};

export default ResponseArea;
