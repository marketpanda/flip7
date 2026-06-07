interface ContainerProps {
    children: React.ReactNode
}

const Container = ({ children }: ContainerProps ) => {
    return (
        <div className="fixed inset-0">
            { children }
        </div>
    )
}

export default Container